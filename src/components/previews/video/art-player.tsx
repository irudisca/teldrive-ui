import { forwardRef, useEffect, useRef } from "react";
import Artplayer, { type Option } from "artplayer";

Artplayer.USE_RAF = true;

interface PlayerProps {
  option: Option;
  poster?: string;
  style: React.CSSProperties;
}

export const Player = forwardRef<Artplayer, PlayerProps>(
  ({ option, poster, ...rest }, ref) => {
    const artRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const art = new Artplayer({
        ...option,
        ...(poster ? { poster } : {}),
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
    }, [option, poster]);
    return <div ref={artRef} {...rest} />;
  },
);
