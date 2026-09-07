import { TraceBrand } from "../components/TraceBrand";
export function About() {
  return (
    <article className="panel prose">
      <TraceBrand />
      <span className="eyebrow">TRACE / V0.2.1-BETA</span>
      <h1>Open-Source Investigation Workbench</h1>
      <p>
        TRACE is intended for lawful open-source research and documentation. It helps
        analysts organize evidence, distinguish facts from hypotheses, and retain source
        provenance.
      </p>
      <h2>Responsible use</h2>
      <p>
        Users are responsible for complying with local law, platform terms, privacy rules,
        and investigative ethics. TRACE must not be used for unauthorized system access,
        credential theft, stalking, harassment, doxxing, impersonation, or interference
        with police investigations.
      </p>
      <h2>Investigative principles</h2>
      <p>
        Separate observations from inferences. Seek independent corroboration, document
        competing explanations, and make unanswered questions explicit. Revisit
        assessments when new evidence arrives.
      </p>
      <h2>Evidence before conclusions</h2>
      <p>
        Confidence labels are analyst assessments, not automated verification. Record
        contradictions, preserve originals, and avoid identifying people based solely on
        weak correlations. A file hash establishes byte integrity relative to the recorded
        hash; it does not establish authenticity, ownership, or legal admissibility.
      </p>
      <h2>Your data stays in your browser</h2>
      <p>
        The application contains only a fictional demo. Real investigations are stored in
        your browser and are never automatically committed to the source repository.
        Exported backups and printed reports leave that boundary: review them before
        sharing.
      </p>
      <p>
        Map tiles load only when you enable the online basemap. External research links
        take you to independent providers with their own terms. TRACE does not scrape
        those services or bypass their access controls.
      </p>
      <h2>Limitations</h2>
      <p>
        Version 0.2.1-beta combines evidence provenance, relationship analysis, a
        qualified timeline, geospatial context, hypothesis testing, structured information
        gaps, a reusable tool library, and printable reports for a single analyst.
        Collaboration, cloud synchronization, AI analysis, authentication, and encrypted
        archives are deferred. The app shell requires a development server or a static
        host; offline installation as a PWA is planned.
      </p>
      <h2>License</h2>
      <p>MIT licensed. See LICENSE and CONTRIBUTING.md in the source distribution.</p>
    </article>
  );
}
