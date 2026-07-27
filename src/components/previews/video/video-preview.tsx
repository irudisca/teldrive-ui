import { memo, useMemo, useRef } from "react";
import type Artplayer from "artplayer";
import type { Option } from "artplayer";
import { Player } from "./art-player";
import { useSession } from "@/utils/query-options";

interface VideoPlayerProps {
  id: string;
  url: string;
}
const VideoPlayer = memo(({ id, url, ...props }: VideoPlayerProps) => {
  const artInstance = useRef<Artplayer | null>(null);
  const [session] = useSession();
  const sessionHash = session?.hash!;
  const posterUrl = useMemo(() => {
    const u = new URL(window.location.origin);
    u.pathname = `/api/files/${id}/thumbnail`;
    u.searchParams.set("hash", sessionHash);
    return u.toString();
  }, [id, sessionHash]);
  const artOptions: Option = {
    container: "",
    url,
    volume: 0.6,
    muted: false,
    autoplay: true,
    pip: true,
    autoSize: false,
    autoMini: true,
    screenshot: true,
    setting: true,
    flip: true,
    playbackRate: true,
    aspectRatio: true,
    fullscreen: true,
    fullscreenWeb: true,
    mutex: true,
    backdrop: true,
    hotkey: true,
    playsInline: true,
    autoPlayback: true,
    airplay: true,
    lock: true,
    fastForward: true,
    autoOrientation: true,
    moreVideoAttr: {
      playsInline: true,
    },
  };

  return (
    <Player
      style={{ aspectRatio: "16 /9" }}
      ref={artInstance}
      option={artOptions}
      poster={posterUrl}
      {...props}
    />
  );
});

export default memo(VideoPlayer);
