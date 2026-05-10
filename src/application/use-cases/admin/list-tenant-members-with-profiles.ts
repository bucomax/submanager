import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { resolveUserProfileImageUrl } from "@/infrastructure/storage/resolve-user-profile-image-url";

export async function tenantExistsById(tenantId: string): Promise<boolean> {
  return tenantPrismaRepository.tenantExistsById(tenantId);
}

export async function listTenantMembersWithProfiles(params: { tenantId: string }) {
  const rows = await tenantPrismaRepository.listActiveTenantMembershipRows(params.tenantId);

  return Promise.all(
    rows.map(async (r) => {
      const imageUrl = await resolveUserProfileImageUrl(r.image);
      return {
        userId: r.userId,
        email: r.email,
        name: r.name,
        image: r.image,
        imageUrl,
        role: r.role,
        restrictedToAssignedOnly: r.restrictedToAssignedOnly,
        linkedOpmeSupplierId: r.linkedOpmeSupplierId,
        hasPassword: r.hasPassword,
      };
    }),
  );
}
