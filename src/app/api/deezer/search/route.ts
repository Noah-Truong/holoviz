import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "deezer_error" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
