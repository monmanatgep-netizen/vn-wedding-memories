
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Music2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Shuffle,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

type Photo = {
  id: string;
  url: string;
  guestName?: string;
  wish?: string;
  photoNo?: number;
};

type Props = {
  images: Photo[];
};

function shuffledIndexes(length: number, avoidFirst?: number) {
  const values = Array.from({ length }, (_, index) => index);

  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  if (
    length > 1 &&
    avoidFirst !== undefined &&
    values[0] === avoidFirst
  ) {
    [values[0], values[1]] = [values[1], values[0]];
  }

  return values;
}

export default function MediaControls({ images }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [seconds, setSeconds] = useState(5);
  const [order, setOrder] = useState<number[]>([]);
  const [position, setPosition] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  async function toggleMusic() {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch (error) {
      console.error(
        "Music playback was blocked or the file is unavailable:",
        error
      );
    }
  }

  function openSlideshow() {
    if (!images.length) return;

    const nextOrder = shuffledIndexes(images.length);
    setOrder(nextOrder);
    setPosition(0);
    setSlideshowOpen(true);
  }

  function moveNext() {
    if (!images.length) return;

    if (position + 1 < order.length) {
      setPosition((current) => current + 1);
      return;
    }

    const currentImage = order[position];

    setOrder(shuffledIndexes(images.length, currentImage));
    setPosition(0);
  }

  function movePrevious() {
    if (position > 0) {
      setPosition((current) => current - 1);
    }
  }

  useEffect(() => {
    if (!slideshowOpen || images.length < 2) return;

    const timer = window.setInterval(
      moveNext,
      seconds * 1000
    );

    return () => window.clearInterval(timer);
  }, [slideshowOpen, seconds, images.length, position, order]);

  useEffect(() => {
    if (!slideshowOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSlideshowOpen(false);
      }

      if (event.key === "ArrowRight") {
        moveNext();
      }

      if (event.key === "ArrowLeft") {
        movePrevious();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () =>
      window.removeEventListener("keydown", onKeyDown);
  }, [slideshowOpen, position, order]);

  const currentPhoto =
    order.length ? images[order[position]] : undefined;

  return (
    <>
      <audio
        ref={audioRef}
        src="/music/wedding.mp3"
        loop
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <section
        className="media-panel glass"
        aria-label="เพลงและสไลด์โชว์"
      >
        <div className="media-panel-heading">
          <span className="iconbubble">
            <Music2 size={19} />
          </span>

          <div>
            <h2>เติมบรรยากาศแห่งความทรงจำ</h2>
            <p>
              เปิดเพลงคลอเบา ๆ หรือรับชมภาพความทรงจำแบบสุ่ม
            </p>
          </div>
        </div>

        <div className="media-controls">
          <button
            className="media-button music-toggle"
            onClick={toggleMusic}
            type="button"
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
            {playing ? "หยุดเพลง" : "เปิดเพลง"}
          </button>

          <div className="volume-control">
            <button
              className="volume-icon"
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}
            >
              {muted || volume === 0
                ? <VolumeX size={18} />
                : <Volume2 size={18} />}
            </button>

            <input
              aria-label="ระดับเสียงเพลง"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) =>
                setVolume(Number(event.target.value))
              }
            />
          </div>

          <button
            className="media-button slideshow-launch"
            onClick={openSlideshow}
            type="button"
            disabled={!images.length}
          >
            <Shuffle size={17} />
            สุ่มภาพสไลด์โชว์
          </button>

          <span className="media-hint">
            เพลงจะเล่นวนซ้ำเมื่อกดเริ่มเล่น
          </span>
        </div>
      </section>

      {slideshowOpen && currentPhoto && (
        <div
          className="slideshow-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="สไลด์โชว์ภาพความทรงจำ"
        >
          <button
            className="slideshow-close"
            type="button"
            onClick={() => setSlideshowOpen(false)}
            aria-label="ปิดสไลด์โชว์"
          >
            <X />
          </button>

          {/* เครื่องมือควบคุมด้านบนขวา */}
          <div
            className="slideshow-toolbar"
            aria-label="เครื่องมือควบคุมสไลด์โชว์"
          >
            <div className="slideshow-controls">
              <button
                type="button"
                onClick={movePrevious}
                disabled={position === 0}
                aria-label="ภาพก่อนหน้า"
              >
                <ChevronLeft />
              </button>

              <span>
                {position + 1} / {images.length}
              </span>

              <button
                type="button"
                onClick={moveNext}
                aria-label="ภาพถัดไป"
              >
                <ChevronRight />
              </button>
            </div>

            <label className="slideshow-speed">
              เปลี่ยน

              <select
                value={seconds}
                onChange={(event) =>
                  setSeconds(Number(event.target.value))
                }
              >
                <option value={3}>3 วินาที</option>
                <option value={5}>5 วินาที</option>
                <option value={8}>8 วินาที</option>
                <option value={10}>10 วินาที</option>
                <option value={15}>15 วินาที</option>
              </select>
            </label>
          </div>

          {/* พื้นที่ภาพ Polaroid */}
          <div className="slideshow-stage">
            <p className="slideshow-thankyou">
              เจ้าสาวและเจ้าบ่าวขอขอบคุณแขกทุกท่าน
            </p>
            <p className="slideshow-thankyou">
              ที่มาเติมเต็มวันที่มีความหมายของเราวันนี้ของเราให้เต็มไปด้วยความสุข
            </p>

            <article
              className="polaroid-frame"
              key={currentPhoto.id}
            >
              <img
                src={currentPhoto.url}
                alt="ภาพความทรงจำในงานแต่ง"
                className="slideshow-image"
              />

              <div className="polaroid-caption">
                <strong className="polaroid-name">
                  {currentPhoto.guestName?.trim() ||
                    "แขกผู้มีเกียรติ"}
                </strong>

                <p className="polaroid-wish">
                  {currentPhoto.wish?.trim() ||
                    "ขอบคุณที่ร่วมแบ่งปันภาพความทรงจำในวันพิเศษของเรา"}
                </p>

                {currentPhoto.photoNo !== undefined && (
                  <span className="polaroid-number">
                    No.{" "}
                    {String(currentPhoto.photoNo).padStart(4, "0")}
                  </span>
                )}
              </div>
            </article>

            <div className="slideshow-caption">
              V&amp;N WEDDING MEMORIES <span>♡</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
