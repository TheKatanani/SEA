"use client";

import { useRef, useState } from "react";
import { CloudUpload, LoaderCircle, Trash2, X } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";

export type UploadedAsset = { url: string; publicId: string; resourceType: string; format?: string; width?: number; height?: number; bytes?: number };

function publicIdFromUrl(value: string) {
  try {
    const url = new URL(value);
    const marker = url.pathname.match(/\/(image|video|raw)\/upload\/(.*)$/);
    if (!marker) return "";
    const segments = decodeURIComponent(marker[2]).split("/").filter(Boolean);
    const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));
    const publicId = (versionIndex >= 0 ? segments.slice(versionIndex + 1) : segments).join("/").replace(/\.[^/.]+$/, "");
    return publicId.startsWith("sea/website/") ? publicId : "";
  } catch {
    return "";
  }
}

export function CloudinaryImageField({
  label,
  value,
  publicId,
  resourceType = "image",
  english,
  onChange,
  onUploaded,
}: {
  label: string;
  value: unknown;
  publicId?: unknown;
  resourceType?: string;
  english: boolean;
  onChange: (url: string, publicId?: string, resourceType?: string) => void;
  onUploaded?: (asset: UploadedAsset, file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const imageUrl = typeof value === "string" ? value : "";
  const assetId = typeof publicId === "string" && publicId ? publicId : publicIdFromUrl(imageUrl);
  const removableAsset = Boolean(assetId && assetId.startsWith("sea/website/"));

  async function upload(file: File) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!file.type.startsWith("image/")) throw new Error(english ? "Choose an image file." : "اختر ملف صورة.");
      if (file.size > 15 * 1024 * 1024) throw new Error(english ? "Images must be 15 MB or smaller." : "يجب ألا يتجاوز حجم الصورة 15 ميغابايت.");
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error(english ? "Sign in to the admin panel first." : "سجّل الدخول إلى لوحة الإدارة أولًا.");
      const idToken = await user.getIdToken();
      const signatureResponse = await fetch("/api/admin/cloudinary-signature", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const signature = await signatureResponse.json().catch(() => ({}));
      if (!signatureResponse.ok) throw new Error(signature.error || (english ? "Could not start the upload." : "تعذر بدء رفع الصورة."));

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signature.apiKey);
      formData.append("timestamp", String(signature.timestamp));
      formData.append("folder", signature.folder);
      formData.append("allowed_formats", signature.allowedFormats);
      formData.append("signature", signature.signature);
      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: "POST", body: formData });
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploaded.error?.message || (english ? "Cloudinary upload failed." : "فشل رفع الصورة إلى Cloudinary."));

      const asset: UploadedAsset = { url: uploaded.secure_url, publicId: uploaded.public_id, resourceType: uploaded.resource_type, format: uploaded.format, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes };
      onChange(asset.url, asset.publicId, asset.resourceType);
      if (onUploaded) {
        try {
          await onUploaded(asset, file);
          setNotice(english ? "Image uploaded and added to the media library. Save the record to publish the change." : "رُفعت الصورة وأُضيفت لمكتبة الوسائط. احفظ السجل لتثبيت التغيير.");
        } catch {
          setNotice(english ? "Image uploaded. Save this record; media library indexing can be retried later." : "رُفعت الصورة. احفظ هذا السجل؛ ويمكن إعادة فهرستها في مكتبة الوسائط لاحقًا.");
        }
      } else {
        setNotice(english ? "Image uploaded. Save the record to keep this change." : "رُفعت الصورة. احفظ السجل لتثبيت التغيير.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : english ? "Image upload failed." : "فشل رفع الصورة.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAsset() {
    if (!removableAsset || busy) return;
    const confirmed = window.confirm(english ? "Permanently delete this image from Cloudinary? This cannot be undone." : "هل تريد حذف الصورة نهائيًا من Cloudinary؟ لا يمكن التراجع عن ذلك.");
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error(english ? "Sign in to the admin panel first." : "سجّل الدخول إلى لوحة الإدارة أولًا.");
      const response = await fetch("/api/admin/cloudinary-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ publicId: assetId, resourceType: resourceType || "image" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || (english ? "Could not delete the Cloudinary image." : "تعذر حذف الصورة من Cloudinary."));
      onChange("", undefined, undefined);
      setNotice(english ? "Image deleted from Cloudinary and removed from this record. Save the record." : "حُذفت الصورة من Cloudinary وأزيلت من السجل. احفظ السجل.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : english ? "Could not delete image." : "تعذر حذف الصورة.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="cloudinary-field">
    <span className="cloudinary-field__label">{label}</span>
    {imageUrl ? <div className="cloudinary-field__preview"><img src={imageUrl} alt={label} /><button type="button" className="cloudinary-field__clear" title={english ? "Remove image from this record" : "إزالة الصورة من هذا السجل"} aria-label={english ? "Remove image from this record" : "إزالة الصورة من هذا السجل"} onClick={() => { onChange("", undefined, undefined); setNotice(english ? "Image removed from this record. Save to keep the change." : "أزيلت الصورة من هذا السجل. احفظ التغيير."); setError(""); }} disabled={busy}><X size={16} /></button></div> : <div className="cloudinary-field__empty">{english ? "No image selected" : "لم يتم اختيار صورة"}</div>}
    <div className="cloudinary-field__actions">
      <button type="button" className="admin-secondary-button" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? <LoaderCircle size={15} className="spin" /> : <CloudUpload size={15} />}{imageUrl ? english ? "Replace image" : "استبدال الصورة" : english ? "Upload image" : "رفع صورة"}</button>
      {removableAsset && <button type="button" className="cloudinary-field__delete" onClick={() => void deleteAsset()} disabled={busy}><Trash2 size={14} />{english ? "Delete from Cloudinary" : "حذفها نهائيًا من Cloudinary"}</button>}
      <input ref={inputRef} type="file" accept="image/*" className="cloudinary-field__input" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} />
    </div>
    {notice && <small className="cloudinary-field__notice" role="status">{notice}</small>}
    {error && <small className="cloudinary-field__error" role="alert">{error}</small>}
  </div>;
}
