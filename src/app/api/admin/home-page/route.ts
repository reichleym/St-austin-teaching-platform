import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const HOME_JSON_PATH = path.join(process.cwd(), "src", "content", "dynamic", "home.json");

export async function GET() {
  try {
    const raw = await fs.readFile(HOME_JSON_PATH, "utf-8");
    const json = JSON.parse(raw);
    return NextResponse.json({ ok: true, page: json });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Unable to load home.json" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    const content = JSON.stringify(body, null, 2);
    await fs.writeFile(HOME_JSON_PATH, content, "utf-8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Unable to save home.json" }, { status: 500 });
  }
}
