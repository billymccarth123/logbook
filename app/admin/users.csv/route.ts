import { listUsers, requireAdmin } from "@/lib/auth";
import { ageFromDob, COVER, LICENCE_TYPES, OCCUPATIONS } from "@/lib/driver-profile";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  // Quote every cell, and stop spreadsheet apps treating text as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await requireAdmin())) return new Response("Not found", { status: 404 });

  const header = [
    "Name", "Email", "Phone", "Role", "Status", "Signed up", "Last login",
    "Age", "County", "Occupation", "Licence", "No claims years", "Penalty points", "Km per year", "Cover",
  ];
  const rows = (await listUsers()).map((user) => {
    const p = user.profile;
    return [
      user.name, user.email, user.phone, user.role, user.status, user.createdAt, user.lastLoginAt,
      p && ageFromDob(p.dateOfBirth), p?.county, p && OCCUPATIONS[p.occupation], p && LICENCE_TYPES[p.licenceType],
      p?.noClaimsYears, p?.penaltyPoints, p?.annualKm, p && COVER[p.cover],
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trucost-users-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
