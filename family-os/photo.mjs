// Optional photo for a task on review (bus 84/97 item 4). Never required — for a child or anyone.
// - Only for `needs_review` tasks, while the task is accepted, in progress or done (not yet reviewed).
// - Added by a participant of the task, or by a parent of a child assignee (the same people who may tick it).
// - Seen by parents only. EXIF/GPS stripped before sealing; sealed under its own data key.
// - Deleted 7 days after upload by the runner (purgePhotos), whether or not it was reviewed.
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { participants, isParent } from "./board.mjs";

export const PHOTO_DAYS = 7;
const PHOTO_STATES = ["accepted", "in_progress", "done"];

const parentOfChild = (me, child, grants) => child?.kind === "child" && grants.some((g) => !g.revoked_at && g.relation === "parent" && g.guardian_id === me.id && g.child_id === child.id);

export function canAddPhoto(me, task, assignee, grants) {
  if (!me || !task?.needs_review || !PHOTO_STATES.includes(task.state)) return false;
  return participants(task).includes(me.id) || parentOfChild(me, assignee, grants);
}

/** Parents only — not the assignee (a child's own photo is not shown back), not relatives or other adults. */
export const canSeePhoto = (me, grants) => Boolean(me) && isParent(me, grants);

export const deleteAfter = (now) => new Date(now.getTime() + PHOTO_DAYS * 86400_000);

export const photoFile = (id) => `photo-${id}`;

/** Delete every photo past its date: the sealed file first, then mark the row. Returns the count. */
export async function purgePhotos({ store, filesDir, now }) {
  let n = 0;
  for (const p of await store.duePhotos(now)) {
    await unlink(join(filesDir, photoFile(p.id))).catch((e) => { if (e.code !== "ENOENT") throw e; });
    await store.markPhotoDeleted(p.id);
    n++;
  }
  return n;
}
