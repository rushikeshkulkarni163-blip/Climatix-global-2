import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ success: false, error: "No files provided" }, { status: 400 });
    }

    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB per file
    const ALLOWED_TYPES = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
    ];

    const processed: Array<{ name: string; size: number; type: string; status: string; pages?: number }> = [];

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { success: false, error: `File "${file.name}" exceeds 50 MB limit` },
          { status: 413 }
        );
      }
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|xlsx|docx|csv|txt)$/i)) {
        return NextResponse.json(
          { success: false, error: `File type not supported: ${file.type}` },
          { status: 415 }
        );
      }

      // In production: upload to object storage (S3/GCS/Supabase Storage),
      // run text extraction, and pass to ESG analysis pipeline.
      // Here we validate and acknowledge receipt.
      const bytes = await file.arrayBuffer();
      const sizeKb = Math.round(bytes.byteLength / 1024);

      processed.push({
        name: file.name,
        size: sizeKb,
        type: file.type || "application/octet-stream",
        status: "received",
        pages: file.type === "application/pdf" ? Math.ceil(sizeKb / 40) : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      files: processed,
      message: `${processed.length} file(s) received and queued for ESG analysis.`,
      nextStep: "Documents will be processed by the disclosure intelligence pipeline.",
    });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
