import { getJobById } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HighlightedDescription } from "@/components/HighlightedDescription";
import { JobViewerButton } from "@/components/JobViewer";
import { DeleteJobButton } from "@/components/DeleteJobButton";
import { PostularButton } from "@/components/PostularButton";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobById(id);
  if (!job) notFound();

  const posted =
    job.postedAt || job.createdAt
      ? new Date((job.postedAt || job.createdAt)!).toLocaleDateString("es-AR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  const salary =
    job.salaryMin || job.salaryMax
      ? `${job.salaryCurrency ?? "USD"} ${job.salaryMin ? `${Math.round(job.salaryMin / 1000)}k` : ""}${job.salaryMin && job.salaryMax ? " – " : ""}${job.salaryMax ? `${Math.round(job.salaryMax / 1000)}k` : ""} / ${job.salaryPeriod ?? "yr"}`
      : null;

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link
            href="/vacantes"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
          >
            ← Volver a vacantes
          </Link>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-gray-900 leading-snug">
                    {job.title}
                  </h1>
                  <p className="text-gray-600 mt-1 font-medium">
                    {job.company}
                  </p>
                </div>
                {job.applyUrl && (
                  <div className="flex items-center gap-2 shrink-0">
                    <JobViewerButton url={job.applyUrl} title={job.title} />
                    <PostularButton
                      jobId={job.id}
                      title={job.title}
                      company={job.company}
                      location={job.location ?? ''}
                      applyUrl={job.applyUrl}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {job.modality && job.modality !== "unknown" && (
                  <Badge color="green">{job.modality}</Badge>
                )}
                {job.seniority && job.seniority !== "unknown" && (
                  <Badge color="purple">{job.seniority}</Badge>
                )}
                {job.location && <Badge color="gray">{job.location}</Badge>}
                {salary && <Badge color="yellow">{salary}</Badge>}
              </div>

              {posted && (
                <p className="text-xs text-gray-400 mt-3">
                  Publicado el {posted}
                </p>
              )}
            </div>

            {/* Skills */}
            {job.requiredSkills && job.requiredSkills.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Skills requeridos
                </h2>
                <div className="flex flex-wrap gap-2">
                  {job.requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="text-sm bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-3 py-1"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {job.niceToHaveSkills && job.niceToHaveSkills.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Nice to have
                </h2>
                <div className="flex flex-wrap gap-2">
                  {job.niceToHaveSkills.map((skill) => (
                    <span
                      key={skill}
                      className="text-sm bg-gray-50 text-gray-600 border border-gray-200 rounded-lg px-3 py-1"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {job.description && (
              <div className="px-6 py-5">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Descripción
                </h2>
                <HighlightedDescription text={job.description} />
              </div>
            )}

            {/* Footer CTA */}
            <div className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex justify-center">
              <DeleteJobButton id={job.id} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

type BadgeColor = "gray" | "green" | "blue" | "purple" | "yellow";
const BADGE_STYLES: Record<BadgeColor, string> = {
  gray: "bg-gray-100 text-gray-600",
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  yellow: "bg-yellow-100 text-yellow-700",
};

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: BadgeColor;
}) {
  return (
    <span
      className={`text-xs rounded-full px-2.5 py-1 font-medium capitalize ${BADGE_STYLES[color]}`}
    >
      {children}
    </span>
  );
}
