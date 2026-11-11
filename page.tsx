"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Search, Upload, Images, Heart, ZoomIn, ZoomOut, Download, X, Sparkles, Camera, LoaderCircle } from "lucide-react";
import { supabase, bucket, publicImageUrl } from "@/lib/supabase";
import { getFaceDescriptors } from "@/lib/faces";
import MediaControls from "@/components/MediaControls";

type Photo = {
  id: string; photo_no: number; storage_path: string; guest_name: string;
  wish: string; face_search_consent: boolean; created_at: string; similarity?: number;
};

const MAX_FILES = 4;
const MAX_SIZE = 15 * 1024 * 1024;



export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [wish, setWish] = useState("");
  const [consent, setConsent] = useState(false);
  const [query, setQuery] = useState("");
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [mode, setMode] = useState<"all" | "face">("all");
  const fileInput = useRef<HTMLInputElement>(null);
  const faceInput = useRef<HTMLInputElement>(null);

  async function loadPhotos() {
    const { data, error } = await supabase.from("photos").select("*").order("photo_no", { ascending: true });
    if (!error && data) setPhotos(data as Photo[]);
    else if (error) setStatus("โหลดคลังภาพไม่สำเร็จ: " + error.message);
  }

  useEffect(() => { loadPhotos(); }, []);

  const filtered = useMemo(() => {
    if (mode === "face") return photos;
    const q = query.trim().toLocaleLowerCase();
    if (!q) return photos;
    return photos.filter(p =>
      String(p.photo_no).padStart(4, "0").includes(q) ||
      p.guest_name.toLocaleLowerCase().includes(q) ||
      p.wish.toLocaleLowerCase().includes(q)
    );
  }, [photos, query, mode]);

  function chooseFiles(list: FileList | null) {
    if (!list) return;
    const chosen = Array.from(list);
    if (chosen.length < 1 || chosen.length > MAX_FILES) {
      setStatus("กรุณาเลือกรูปภาพ 1–4 รูปต่อครั้ง");
      return;
    }
    if (chosen.some(f => !f.type.startsWith("image/") || f.size > MAX_SIZE)) {
      setStatus("รองรับไฟล์ภาพขนาดไม่เกิน 15 MB ต่อรูป");
      return;
    }
    setFiles(chosen);
    setStatus("");
  }

  async function submitUpload() {
    if (!name.trim()) return setStatus("กรุณากรอกชื่อผู้ส่งภาพ");
    if (!files.length) return setStatus("กรุณาเลือกรูปภาพ 1–4 รูป");
    setBusy(true); setStatus("กำลังอัปโหลดภาพ...");
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `uploads/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;

        const { data: photo, error: insertError } = await supabase.from("photos").insert({
          storage_path: path, guest_name: name.trim(), wish: wish.trim(),
          face_search_consent: consent
        }).select().single();
        if (insertError) throw insertError;

        if (consent) {
          try {
            const descriptors = await getFaceDescriptors(file);
            if (descriptors.length) {
              const rows = descriptors.map(embedding => ({ photo_id: photo.id, embedding }));
              const { error: faceError } = await supabase.from("face_embeddings").insert(rows);
              if (faceError) console.warn("Face indexing skipped:", faceError.message);
            }
          } catch (faceError) {
            console.warn("Face model unavailable:", faceError);
          }
        }
      }
      setFiles([]); setWish(""); setConsent(false);
      if (fileInput.current) fileInput.current.value = "";
      await loadPhotos();
      setStatus("อัปโหลดเรียบร้อยแล้ว ขอบคุณที่ร่วมแบ่งปันความทรงจำ 💗");
    } catch (e: any) {
      setStatus("อัปโหลดไม่สำเร็จ: " + (e?.message || "กรุณาลองใหม่"));
    } finally { setBusy(false); }
  }

  async function searchFace() {
    if (!faceFile) return setStatus("กรุณาเลือกรูปใบหน้าสำหรับค้นหา");
    setBusy(true); setStatus("กำลังวิเคราะห์ใบหน้า...");
    try {
      const descriptors = await getFaceDescriptors(faceFile);
      if (!descriptors.length) throw new Error("ไม่พบใบหน้าในภาพตัวอย่าง");
      if (descriptors.length > 1) throw new Error("กรุณาใช้ภาพตัวอย่างที่มีใบหน้าเพียง 1 คน");
      const { data, error } = await supabase.rpc("match_faces", {
        query_embedding: `[${descriptors[0].join(",")}]`,
        match_count: 100
      });
      if (error) throw error;
      setPhotos((data || []) as Photo[]);
      setMode("face");
      setSelected([]);
      setStatus(`พบภาพที่มีใบหน้าคล้ายกัน ${data?.length || 0} ภาพ (เรียงตามความคล้ายคลึง)`);
    } catch (e: any) {
      setStatus(e?.message || "ค้นหาใบหน้าไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  async function resetFaceSearch() {
    setMode("all"); setFaceFile(null); setSelected([]);
    await loadPhotos();
  }

  async function downloadPhotos(items: Photo[]) {
    if (!items.length) return setStatus("กรุณาเลือกภาพก่อนดาวน์โหลด");
    setBusy(true); setStatus("กำลังเตรียมไฟล์ดาวน์โหลด...");
    try {
      const zip = new JSZip();
      for (const p of items) {
        const response = await fetch(publicImageUrl(p.storage_path));
        if (!response.ok) continue;
        const blob = await response.blob();
        zip.file(`${String(p.photo_no).padStart(4, "0")}.jpg`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url; a.download = "VN-Wedding-Memories.zip"; a.click();
      URL.revokeObjectURL(url);
      setStatus("เตรียมไฟล์ดาวน์โหลดเรียบร้อย");
    } catch { setStatus("ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setBusy(false); }
  }

  function toggleSelected(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <main className="page">
      <header className="hero glass">
        <div className="tiny-hearts">♡　♥　♡</div>
        <p className="eyebrow">A DAY TO REMEMBER · 22 JANUARY 2027</p>
        <h1>V<span>&</span>N Wedding Day</h1>
        <p className="subtitle">ร่วมแชร์ความทรงจำร่วมกันกับเราในวันนี้</p>
        <p className="intro">ทุกภาพมีเรื่องราว ทุกคำอวยพรมีความหมาย<br/>มาร่วมเก็บช่วงเวลาพิเศษนี้ไว้ด้วยกัน</p>
        <div className="names">PARICHART <span>♡</span> MONMANAT</div><p className="venue">22 JANUARY 2027 · REINDEER PARK RESORT, NAKHON NAYOK</p>
      </header>

      <MediaControls
        images={photos.map((photo) => ({
          id: photo.id,
          url: publicImageUrl(photo.storage_path),
          guestName: photo.guest_name,
          wish: photo.wish,
          photoNo: photo.photo_no,
        }))}
      />

      <section className="upload glass">
        <div className="section-title"><span className="iconbubble"><Upload size={19}/></span><div><h2>แบ่งปันภาพความทรงจำ</h2><p>อัปโหลดภาพ 1–4 รูป พร้อมฝากคำอวยพรถึงคู่บ่าวสาว</p></div></div>
        <button className="dropzone" onClick={() => fileInput.current?.click()}>
          <Images size={34}/><strong>เลือกภาพที่ต้องการแบ่งปัน</strong><span>คลิกเพื่อเลือกรูปภาพ · สูงสุด 4 รูป · 15 MB ต่อรูป</span>
          <input ref={fileInput} hidden type="file" accept="image/*" multiple onChange={e => chooseFiles(e.target.files)}/>
        </button>
        {files.length > 0 && <div className="previewrow">{files.map((f,i)=><div className="preview" key={i}><img src={URL.createObjectURL(f)} alt="preview"/><button onClick={()=>setFiles(old=>old.filter((_,n)=>n!==i))}><X size={14}/></button></div>)}</div>}
        <div className="formgrid">
          <label>ชื่อผู้ส่งภาพ<input value={name} onChange={e=>setName(e.target.value)} placeholder="เช่น คุณสมชาย ใจดี" maxLength={80}/></label>
          <label className="wide">คำอวยพร<textarea value={wish} onChange={e=>setWish(e.target.value)} placeholder="เขียนข้อความดี ๆ ถึงคู่บ่าวสาว..." rows={3} maxLength={1000}/></label>
        </div>
        <label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> ยินยอมให้ระบบนำใบหน้าที่ปรากฏในภาพนี้ไปสร้างข้อมูลสำหรับค้นหาภาพที่มีใบหน้าคล้ายกัน โดยสามารถขอให้ลบข้อมูลได้</label>
        <button className="primary" disabled={busy} onClick={submitUpload}>{busy ? <LoaderCircle className="spin"/> : <Upload size={18}/>} {busy ? "กำลังดำเนินการ..." : "ส่งภาพและคำอวยพร"}</button>
      </section>

      <section className="searchpanel glass">
        <div className="section-title"><span className="iconbubble pink"><Search size={19}/></span><div><h2>ค้นหาความทรงจำ</h2><p>ค้นหาด้วยชื่อ คำอวยพร หมายเลขภาพ หรือใบหน้า</p></div></div>
        <div className="searchbar"><Search size={19}/><input value={query} onChange={e=>{setQuery(e.target.value); if(mode==="face") setMode("all");}} placeholder="ค้นหาชื่อ คำอวยพร หรือหมายเลข เช่น 0025"/><button onClick={()=>setQuery("")}>ล้าง</button></div>
        <div className="face-search">
          <div><Camera size={20}/><strong>ค้นหาด้วยใบหน้า AI</strong><p>เลือกรูปตัวอย่างที่มีใบหน้าเพียง 1 คน ระบบจะเรียงภาพตามความคล้ายคลึง</p></div>
          <input ref={faceInput} type="file" accept="image/*" onChange={e=>setFaceFile(e.target.files?.[0] || null)}/>
          <button className="secondary" disabled={busy} onClick={searchFace}>ค้นหาใบหน้า</button>
          {mode==="face" && <button className="textbutton" onClick={resetFaceSearch}>กลับไปดูทั้งหมด</button>}
        </div>
        <p className="privacy">การค้นหาใบหน้าจะแสดงเฉพาะภาพที่เจ้าของภาพยินยอมให้ใช้ระบบค้นหาใบหน้าเท่านั้น</p>
      </section>

      <section className="gallerysection">
        <div className="galleryhead"><div><p className="eyebrow">OUR SHARED MOMENTS</p><h2>{mode==="face" ? "ผลการค้นหาใบหน้า" : "คลังภาพความทรงจำ"}</h2><p>{mode==="face" ? "เรียงจากใบหน้าที่คล้ายมากไปน้อย" : `ภาพทั้งหมด ${filtered.length} ภาพ`}</p></div>
          <div className="zoomcontrols"><button onClick={()=>setZoom(z=>Math.max(.65,z-.15))} aria-label="ซูมออก"><ZoomOut/></button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.min(1.5,z+.15))} aria-label="ซูมเข้า"><ZoomIn/></button></div>
        </div>
        <div className="toolbar"><span>{selected.length} ภาพที่เลือก</span><button onClick={()=>setSelected(filtered.map(p=>p.id))}>เลือกทั้งหมด</button><button onClick={()=>setSelected([])}>ยกเลิกเลือก</button><button className="download" disabled={busy} onClick={()=>downloadPhotos(selected.length ? filtered.filter(p=>selected.includes(p.id)) : [])}><Download size={16}/> ดาวน์โหลดที่เลือก</button><button className="download all" disabled={busy} onClick={()=>downloadPhotos(filtered)}><Download size={16}/> ดาวน์โหลดทั้งหมด</button></div>
        <div className="photo-wall" style={{"--zoom":zoom} as React.CSSProperties}>
          {filtered.map((p,i)=><article className={`photo-card ${i%7===0?"tilt":""}`} key={p.id}>
            <div className="photo-number">{String(p.photo_no).padStart(4,"0")}</div>
            <label className="selectphoto"><input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggleSelected(p.id)}/></label>
            <button className="imagebutton" onClick={()=>setLightbox(p)}><img src={publicImageUrl(p.storage_path)} alt={`ภาพ ${p.photo_no}`}/></button>
            <div className="photocaption"><strong>{p.guest_name}</strong>{p.wish && <p>“{p.wish}”</p>}{mode==="face" && <small>ความคล้ายคลึง {Math.round((p.similarity || 0)*100)}%</small>}</div>
          </article>)}
          {!filtered.length && <div className="empty"><Heart size={34}/><strong>ยังไม่พบภาพที่ค้นหา</strong><span>ลองค้นหาด้วยคำอื่น หรือกลับไปดูภาพทั้งหมด</span></div>}
        </div>
      </section>
      
      <footer><div>♡</div><strong>V&N Wedding Day&apos;s</strong><span>Thank you for being part of our beautiful memories.</span></footer>
      {status && <div className="toast" role="status">{status}<button onClick={()=>setStatus("")}><X size={15}/></button></div>}
      {lightbox && <div className="lightbox" onClick={()=>setLightbox(null)}><button className="close" onClick={()=>setLightbox(null)}><X/></button><img src={publicImageUrl(lightbox.storage_path)} alt="ภาพขยาย" onClick={e=>e.stopPropagation()}/><div className="lightcaption">#{String(lightbox.photo_no).padStart(4,"0")} · {lightbox.guest_name}<p>{lightbox.wish}</p></div></div>}
    </main>
  );
}
