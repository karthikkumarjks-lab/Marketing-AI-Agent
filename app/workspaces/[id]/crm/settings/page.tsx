import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStages } from "@/lib/crm-server";
import { parseSelectOptions } from "@/lib/crm";
import CustomFieldsManager from "@/components/custom-fields-manager";
import PipelineStagesManager from "@/components/pipeline-stages-manager";

export default async function CrmSettingsPage({ params }: PageProps<"/workspaces/[id]/crm/settings">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const [stages, fields] = await Promise.all([
    ensureDefaultStages(id),
    prisma.customFieldDef.findMany({ where: { workspaceId: id, entity: "lead" }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="grid grid-cols-2 gap-6">
      <PipelineStagesManager
        workspaceId={id}
        stages={stages.map((s) => ({ id: s.id, name: s.name, isWon: s.isWon, isLost: s.isLost }))}
      />
      <CustomFieldsManager
        workspaceId={id}
        fields={fields.map((f) => ({
          id: f.id,
          key: f.key,
          label: f.label,
          fieldType: f.fieldType as "text" | "number" | "date" | "boolean" | "select",
          options: parseSelectOptions(f.options),
          isRequired: f.isRequired,
        }))}
      />
    </div>
  );
}
