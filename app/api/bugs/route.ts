import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export interface Bug {
  id: number;
  crewName: string;
  type: string;
  description: string;
  createdAt: string;
  resolved: boolean;
}

const DATA_DIR = join(process.cwd(), "data");
const BUGS_FILE = join(DATA_DIR, "bugs.json");

function readBugs(): Bug[] {
  if (!existsSync(BUGS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(BUGS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeBugs(bugs: Bug[]) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(BUGS_FILE, JSON.stringify(bugs, null, 2));
}

export async function GET() {
  return NextResponse.json(readBugs());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const bugs = readBugs();
  const newBug: Bug = {
    id: Date.now(),
    crewName: body.crewName || "",
    type: body.type || "기타",
    description: body.description || "",
    createdAt: new Date().toISOString(),
    resolved: false,
  };
  bugs.unshift(newBug);
  writeBugs(bugs);
  return NextResponse.json(newBug, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { id, resolved } = await req.json();
  const bugs = readBugs();
  const bug = bugs.find(b => b.id === id);
  if (!bug) return NextResponse.json({ error: "not found" }, { status: 404 });
  bug.resolved = resolved;
  writeBugs(bugs);
  return NextResponse.json({ ok: true });
}
