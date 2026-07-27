import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FileData } from "@tw-material/file-browser";

import { mediaUrl } from "@/utils/common";

// Small guard so a cursor sweep across the grid doesn't fire a preview for
// every tile it passes under.
const HOVER_DELAY_MS = 100;

// @tw-material/file-browser stamps every rendered file row/tile (grid, list
// and tile view alike) with these two data attributes - see
// useFileEntryHtmlProps in the package's FileEntry-hooks. That's a more
// robust tile->file lookup than parsing the thumbnail <img> src: it works
// regardless of view mode and even before/if the thumbnail image itself has
// loaded (or failed to load).
const FILE_ENTRY_SELECTOR = '[data-test-id="file-entry"]';

// Within a tile, the actual thumbnail box (not the whole tile, which also
// includes the name label above it and the date/size caption below it).
// Per the package's FileEntry.tsx (see GridEntryPreview/FileThumbnail in
// node_modules/@tw-material/file-browser/dist/index.mjs): once art has
// loaded, the box contains a single `<img>` (there's only one <img> in the
// whole package - icons render as inline SVG via FbIcon); before/if that
// resolves, it's an empty aspect-ratio'd div (`aspect-[16/10]`) holding a
// centered fallback icon instead. Grid view is the only mode with a
// thumbnail box at all - list/tile view only show a small fixed icon - so
// this deliberately falls through to the full tile rect there.
const THUMBNAIL_IMG_SELECTOR = "img";
const THUMBNAIL_BOX_SELECTOR = '[class*="aspect-"]';

function getThumbnailElement(tile: HTMLElement): HTMLElement {
  return (
    tile.querySelector<HTMLElement>(THUMBNAIL_IMG_SELECTOR) ??
    tile.querySelector<HTMLElement>(THUMBNAIL_BOX_SELECTOR) ??
    tile
  );
}

type VideoHoverPreviewProps = {
  containerRef: RefObject<HTMLElement | null>;
  files: FileData[];
  sessionHash?: string;
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * Desktop-only nicety: hovering a video tile in the file grid for ~100ms
 * overlays a small muted player, absolutely positioned over the tile's
 * thumbnail box, that streams the video from its midpoint. Mounted alongside
 * <FileBrowser /> and driven by delegated mouse events on its scroll
 * container, since the grid tiles themselves are rendered inside the
 * (unforkable) external package.
 */
export function VideoHoverPreview({ containerRef, files, sessionHash }: VideoHoverPreviewProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [src, setSrc] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTileRef = useRef<HTMLElement | null>(null);

  // Kept in a ref (rather than an effect dependency) so a refetched `files`
  // page doesn't tear down and re-attach the delegated listeners mid-hover.
  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => {
    const container = containerRef.current;
    // Same gating as thumbnails: no session hash, no authorized stream URL.
    if (!container || !sessionHash) {
      return;
    }

    const clearTimer = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const teardown = () => {
      clearTimer();
      activeTileRef.current = null;
      setRect(null);
      setSrc(null);
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const tile = target?.closest<HTMLElement>(FILE_ENTRY_SELECTOR);
      if (!tile || tile === activeTileRef.current) {
        return;
      }
      // Moving straight from one tile to another: drop the previous
      // preview/timer so only one is ever pending or mounted.
      if (activeTileRef.current) {
        teardown();
      }

      const fileId = tile.dataset.fileId;
      if (!fileId) {
        return;
      }
      const file = filesRef.current.find((f) => f.id === fileId);
      if (!file || file.previewType !== "video") {
        return;
      }

      activeTileRef.current = tile;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (activeTileRef.current !== tile) {
          return;
        }
        const bounds = getThumbnailElement(tile).getBoundingClientRect();
        setRect({
          top: bounds.top,
          left: bounds.left,
          width: bounds.width,
          height: bounds.height,
        });
        // Stream endpoint ignores the name segment of the URL - only the
        // file id + hash matter - but reuse the real name since we already
        // have it from the file list, for a truthful URL.
        setSrc(mediaUrl(file.id, file.name, "", sessionHash));
      }, HOVER_DELAY_MS);
    };

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const tile = target?.closest<HTMLElement>(FILE_ENTRY_SELECTOR);
      if (!tile || tile !== activeTileRef.current) {
        return;
      }
      const related = event.relatedTarget as Node | null;
      if (related && tile.contains(related)) {
        // Still within the same tile (moved over a child element).
        return;
      }
      teardown();
    };

    // Scroll events don't bubble, but a capture listener on an ancestor
    // still observes them from any descendant scroll container (e.g. the
    // Virtuoso viewport) during the capture phase.
    const handleScroll = () => {
      if (activeTileRef.current) {
        teardown();
      }
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("scroll", handleScroll, true);
    container.addEventListener("mouseleave", teardown);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("scroll", handleScroll, true);
      container.removeEventListener("mouseleave", teardown);
      teardown();
    };
  }, [containerRef, sessionHash]);

  if (!rect || !src) {
    return null;
  }

  return createPortal(
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      preload="metadata"
      className="fixed rounded-lg object-contain bg-black shadow-lg z-50 pointer-events-none"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;
        if (Number.isFinite(video.duration)) {
          video.currentTime = video.duration / 2;
        }
        video.play().catch(() => {
          // Autoplay can be rejected (e.g. no user gesture yet); ignore.
        });
      }}
    />,
    document.body,
  );
}
