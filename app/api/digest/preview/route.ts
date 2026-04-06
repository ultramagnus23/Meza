import { NextResponse } from "next/server";
import { generateDigestMessage } from "@/lib/digest/generateMessage";

export async function GET() {
  try {
    const message = await generateDigestMessage();
    return NextResponse.json({ message });
  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
