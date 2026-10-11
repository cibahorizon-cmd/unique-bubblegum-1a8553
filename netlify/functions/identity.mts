import type { UserDeletedEvent, UserValidateEvent } from "@netlify/functions";
import { eq, inArray } from "drizzle-orm";
import { database } from "../../db/index.js";
import { applications, jobs, profiles } from "../../db/schema.js";
import { launchReady } from "../../server/content.js";
import { siteSettings } from "../../server/data.js";

export default {
  async userValidate(event: UserValidateEvent) {
    if (event.user.invitedAt) return;
    try {
      const metadata = event.user.userMetadata ?? {};
      if (!launchReady(await siteSettings()) || !["candidat", "recruteur"].includes(String(metadata.account_type)) || !metadata.terms_accepted_at) {
        return event.deny();
      }
    } catch {
      return event.deny();
    }
  },
  async userDeleted(event: UserDeletedEvent) {
    try {
      await database().transaction(async (transaction) => {
        const owned = await transaction.select({ id: jobs.id }).from(jobs).where(eq(jobs.ownerId, event.user.id));
        await transaction.delete(applications).where(eq(applications.candidateId, event.user.id));
        if (owned.length) await transaction.delete(applications).where(inArray(applications.jobId, owned.map((job) => job.id)));
        await transaction.delete(jobs).where(eq(jobs.ownerId, event.user.id));
        await transaction.delete(profiles).where(eq(profiles.id, event.user.id));
      });
    } catch {
      throw new Error("La suppression des données du compte doit être réessayée.");
    }
  },
};
