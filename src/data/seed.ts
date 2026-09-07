import { normalizeInstant, exactTime } from "../models/time";
import { db, saveRecord, saveRelationship } from "../db/database";
import {
  definitions,
  type Kind,
  type Values,
  type LinkSelection,
} from "../models/schema";
export async function seed() {
  await db.transaction(
    "rw",
    [db.meta, db.records, db.counters, db.activity, db.relationships],
    async () => {
      if (await db.meta.get("initialized")) return;
      const c = await saveRecord("cases", "", "Harbor Signal", {
        caseNumber: "TRACE-DEMO-001",
        type: "Infrastructure research",
        jurisdiction: "Fictional demonstration",
        status: "active",
        priority: "medium",
        summary:
          "A fictional training exercise examining inconsistent public descriptions of a harbor monitoring project. Every organization, record, and event in this case is invented.",
        objective:
          "Reconstruct the public timeline and assess whether two fictional installations belong to the same project.",
        tags: ["demo", "fictional", "infrastructure"],
      });
      const add = (k: Kind, t: string, input: Values) => {
        const values = { ...input };
        const links: LinkSelection = {};
        for (const f of definitions[k].fields.filter((f) => f.type === "links")) {
          if (values[f.key] !== undefined) {
            links[f.key] = values[f.key] as string[];
            delete values[f.key];
          }
        }
        return saveRecord(k, c.id, t, values, undefined, links);
      };
      const e1 = await add("entities", "Northlight Research", {
        type: "organization",
        description: "Fictional operator of a harbor observation pilot.",
        confidence: "moderate",
        tags: ["fictional", "operator"],
      });
      const e2 = await add("entities", "Harbor Relay 07", {
        type: "device",
        description: "Fictional monitoring installation referenced in demo records.",
        confidence: "high",
        tags: ["fictional", "sensor"],
      });
      const e3 = await add("entities", "harbor-signal.example", {
        type: "domain",
        description: "Reserved example domain used for this fictional exercise.",
        confidence: "confirmed",
        tags: ["fictional", "infrastructure"],
      });
      const loc1 = await add("locations", "West pier observation point", {
        latitude: 50.807,
        longitude: -1.108,
        category: "observation",
        description:
          "Illustrative coordinate only. No real activity or subject is alleged.",
      });
      const loc2 = await add("locations", "East terminal reference point", {
        latitude: 50.797,
        longitude: -1.088,
        category: "infrastructure",
        description: "Illustrative coordinate only. Not a real investigation.",
      });
      const s = await add("sources", "Fictional harbor project bulletin", {
        publisher: "Harbor Signal demo dataset",
        reliability: "D — unverified public claim",
        notes: "Entirely synthetic source for demonstration; no actual bulletin exists.",
      });
      const ev1 = await add("evidence", "Pilot project announcement", {
        type: "document",
        description:
          "Synthetic bulletin describes a two-station environmental monitoring pilot.",
        sources: [s.id],
        entities: [e1.id],
        reliability: "D — unverified public claim",
        confidence: "moderate",
        observed: normalizeInstant("2026-08-10T09:00Z"),
        collected: normalizeInstant("2026-08-18T10:00Z"),
        tags: ["demo", "announcement"],
      });
      const ev2 = await add("evidence", "West pier installation reference", {
        type: "map",
        description:
          "Synthetic observation places Relay 07 at the west pier reference point.",
        entities: [e2.id],
        locations: [loc1.id],
        sources: [s.id],
        reliability: "D — unverified public claim",
        confidence: "moderate",
        observed: normalizeInstant("2026-08-12T14:30Z"),
        collected: normalizeInstant("2026-08-18T10:15Z"),
        tags: ["demo", "location"],
      });
      const ev3 = await add("evidence", "Archived project page description", {
        type: "webpage",
        description:
          "Synthetic archived text associates the example domain with Northlight Research.",
        entities: [e1.id, e3.id],
        sources: [s.id],
        reliability: "D — unverified public claim",
        confidence: "low",
        observed: normalizeInstant("2026-08-15T11:00Z"),
        collected: normalizeInstant("2026-08-18T11:00Z"),
        tags: ["demo", "archive"],
      });
      const ev4 = await add("evidence", "Conflicting installation date", {
        type: "communication",
        description:
          "Synthetic public claim gives an earlier installation date. Independent corroboration is absent.",
        entities: [e2.id],
        locations: [loc2.id],
        sources: [s.id],
        reliability: "D — unverified public claim",
        confidence: "low",
        observed: normalizeInstant("2026-08-17T16:00Z"),
        collected: normalizeInstant("2026-08-18T11:30Z"),
        tags: ["demo", "contradiction"],
      });
      for (const [title, timestamp, evidence] of [
        ["Pilot announced", "2026-08-10T09:00", ev1.id],
        ["West pier reference published", "2026-08-12T14:30", ev2.id],
        ["Project page archived", "2026-08-15T11:00", ev3.id],
        ["Conflicting date identified", "2026-08-17T16:00", ev4.id],
      ])
        await add("timeline", title, {
          time: exactTime(`${timestamp}Z`),
          evidence: [evidence],
          confidence: "moderate",
          sources: [s.id],
          description: "Fictional demonstration event.",
        });
      await add("hypotheses", "Both installations belong to the same pilot", {
        description: "Assess common operator, timing, and technical references.",
        confidence: "moderate",
        status: "open",
        supporting: [ev1.id, ev2.id, ev3.id],
        contradicting: [ev4.id],
        entities: [e1.id, e2.id],
        notes: "Shared context is not proof of common ownership.",
      });
      await add("gaps", "What is the verified installation date?", {
        description: "Two synthetic records provide different dates.",
        status: "open",
        priority: "high",
        importance: "The chronology affects the common-project hypothesis.",
        methods:
          "Locate an original dated project record; compare independent public sources.",
        evidence: [ev2.id, ev4.id],
      });
      await add("leads", "Locate the original project schedule", {
        status: "open",
        priority: "high",
        description: "Seek independent corroboration for the demonstration timeline.",
        nextAction: "Identify a primary public schedule and record provenance.",
        entities: [e1.id],
        evidence: [ev1.id],
      });
      for (const [from, to, type] of [
        [e1.id, e2.id, "ASSOCIATED_WITH"],
        [e1.id, e3.id, "USES"],
        [e2.id, loc1.id, "SEEN_AT"],
        [loc1.id, loc2.id, "ROUTE"],
      ])
        await saveRelationship({
          caseId: c.id,
          from,
          to,
          type,
        });
      const tools = [
        ["Google", "General Search", "https://www.google.com/"],
        ["Bing", "General Search", "https://www.bing.com/"],
        ["Yandex", "General Search", "https://yandex.com/"],
        ["DuckDuckGo", "General Search", "https://duckduckgo.com/"],
        ["Wayback Machine", "Archives", "https://web.archive.org/"],
        ["OpenStreetMap", "Maps", "https://www.openstreetmap.org/"],
        ["Google Earth", "Satellite", "https://earth.google.com/"],
        ["Bellingcat Toolkit", "General Search", "https://bellingcat.gitbook.io/toolkit"],
        ["Shodan", "IP / Infrastructure", "https://www.shodan.io/"],
        ["Censys", "IP / Infrastructure", "https://search.censys.io/"],
        ["VirusTotal", "Threat Intelligence", "https://www.virustotal.com/"],
        ["urlscan.io", "Cybersecurity", "https://urlscan.io/"],
        ["crt.sh", "Domain / DNS", "https://crt.sh/"],
        ["Have I Been Pwned", "Email", "https://haveibeenpwned.com/"],
        ["ExifTool", "Metadata", "https://exiftool.org/"],
        ["TinEye", "Reverse Image Search", "https://tineye.com/"],
        ["Google Lens", "Reverse Image Search", "https://lens.google/"],
        ["GitHub", "General Search", "https://github.com/"],
        [
          "Companies House",
          "Corporate Records",
          "https://find-and-update.company-information.service.gov.uk/",
        ],
        ["OpenCorporates", "Corporate Records", "https://opencorporates.com/"],
      ];
      const toolDescriptions: Record<string, string> = {
        "Wayback Machine":
          "Review archived versions of websites and compare historical page changes.",
        OpenStreetMap:
          "Explore open geographic data and record analyst-defined location context.",
        "Google Earth":
          "Compare satellite and 3D imagery to understand terrain and site context.",
        "Bellingcat Toolkit":
          "Browse a curated collection of open-source investigation methods and references.",
        Shodan:
          "Search indexed internet-connected services, banners and exposed infrastructure metadata.",
        Censys:
          "Search public internet scans for hosts, services, certificates and network exposure.",
        VirusTotal:
          "Review shared malware, URL, domain and file reputation reports from multiple sources.",
        "urlscan.io":
          "Inspect public website scan results, network requests, domains and page resources.",
        "crt.sh":
          "Search Certificate Transparency logs for domains, subdomains and issued TLS certificates.",
        "Have I Been Pwned":
          "Check whether an email address appears in known data breaches; do not submit sensitive data without consent.",
        ExifTool:
          "Inspect embedded metadata in local files, including timestamps, camera fields and document properties.",
        TinEye:
          "Find copies and earlier appearances of an image using reverse-image search.",
        "Google Lens":
          "Search with an image to find visually similar results and possible source context.",
        GitHub:
          "Search public code, issues and commit history for repositories and technical context.",
        "Companies House":
          "Search UK company filings, officers and registered-office history.",
        OpenCorporates:
          "Search public corporate records and company relationships across supported jurisdictions.",
      };
      for (const [title, category, url] of tools)
        await saveRecord("tools", "", title, {
          category,
          url,
          description:
            toolDescriptions[title] ??
            `Search public ${category.toLowerCase()} references; verify coverage and terms at the provider.`,
          favorite: ["Wayback Machine", "Bellingcat Toolkit", "OpenStreetMap"].includes(
            title,
          ),
          pricing: "freemium",
          account: "optional",
        });
      await db.meta.put({ id: "initialized", value: "1" });
      await db.meta.put({ id: "activeCase", value: c.id });
    },
  );
}
