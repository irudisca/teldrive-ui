import { forwardRef, useEffect, useRef } from "react";
import Artplayer, { type Option } from "artplayer";

Artplayer.USE_RAF = true;

// Backend storyboard contract: /api/files/{id}/storyboard always returns a
// sprite sheet of exactly 20 frames laid out in 5 columns (4 rows).
const storyboardFrames = 20;
const storyboardColumns = 5;

interface PlayerProps {
  option: Option;
  poster?: string;
  storyboard?: string;
  style: React.CSSProperties;
}

export const Player = forwardRef<Artplayer, PlayerProps>(
  ({ option, poster, storyboard, ...rest }, ref) => {
    const artRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const art = new Artplayer({
        ...option,
        ...(poster ? { poster } : {}),
        ...(storyboard
          ? { thumbnails: { url: storyboard, number: storyboardFrames, column: storyboardColumns } }
          : {}),
        container: artRef.current!,
      });
      art.aspectRatio = "16:9";
      if (ref && typeof ref !== "function") ref.current = art;
      else if (ref && typeof ref === "function") ref(art);

      return () => {
        if (art?.destroy) {
          art.video.pause();
          art.video.removeAttribute("src");
          art.video.load();
          art.destroy(false);
        }
      };
    }, [option, poster, storyboard]);
    return <div ref={artRef} {...rest} />;
  },
);
