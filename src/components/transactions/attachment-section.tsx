"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Upload, Trash2, Download, FileText, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { addAttachment, deleteAttachment, listAttachments, type AttachmentRow } from "@/app/(app)/lancamentos/actions";
import { ALLOWED_MIME_TYPES, MAX_SIZE_BYTES } from "@/lib/zod-schemas/attachment";

interface Props {
  transactionId: string | null; // null quando é novo (ainda não criou)
  open: boolean;
}

const ACCEPT = ALLOWED_MIME_TYPES.join(",");

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <Image className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function AttachmentSection({ transactionId, open }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega anexos ao abrir (ou quando transactionId muda)
  const fetchAttachments = useCallback(async () => {
    if (!transactionId) { setItems([]); return; }
    setLoading(true);
    const data = await listAttachments(transactionId);
    setItems(data);
    setLoading(false);
  }, [transactionId]);

  useEffect(() => {
    if (open) fetchAttachments();
  }, [open, fetchAttachments]);

  // Upload
  async function handleFile(file: File) {
    if (!transactionId) {
      setError("Salve o lançamento antes de anexar arquivos.");
      return;
    }
    setError(null);

    // Validação client
    if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
      setError("Tipo de arquivo não permitido. Envie imagens ou PDF.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Arquivo muito grande (máximo 10 MB).");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Não autenticado"); setUploading(false); return; }

      // Upload para Storage
      const path = `${user.id}/${transactionId}/${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("anexos")
        .upload(path, file, { upsert: false });
      if (uploadErr) {
        setError(uploadErr.message);
        setUploading(false);
        return;
      }

      // Registra no banco
      const res = await addAttachment({
        transaction_id: transactionId,
        file_name: file.name,
        mime_type: file.type as typeof ALLOWED_MIME_TYPES[number],
        size_bytes: file.size,
        storage_key: path,
      });
      if (!res.ok) {
        setError(res.error);
        setUploading(false);
        return;
      }

      await fetchAttachments();
    } catch {
      setError("Erro ao enviar arquivo.");
    }
    setUploading(false);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Download (URL assinada)
  async function download(att: AttachmentRow) {
    const supabase = createClient();
    const { data, error: dlErr } = await supabase.storage
      .from("anexos")
      .createSignedUrl(att.storage_key, 60);
    if (dlErr || !data) return;
    window.open(data.signedUrl, "_blank");
  }

  // Delete
  async function remove(att: AttachmentRow) {
    const supabase = createClient();
    await supabase.storage.from("anexos").remove([att.storage_key]);
    await deleteAttachment(att.id);
    await fetchAttachments();
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5" />
        Anexos
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">({items.length})</span>
        )}
      </Label>

      {/* Lista de anexos */}
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
            >
              {fileIcon(att.mime_type)}
              <span className="min-w-0 flex-1 truncate">{att.file_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(att.size_bytes)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => download(att)}
                title="Baixar"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => remove(att)}
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Input de upload */}
      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          className="hidden"
          id="attachment-input"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading || !transactionId}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? "Enviando…" : "Adicionar arquivo"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
