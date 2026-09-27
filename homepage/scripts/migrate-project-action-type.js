// Migration: Ensure projects have actionType set and remove legacy actionPath field.
//
// How to run locally (Linux / Bash):
//   docker cp ./scripts/migrate-project-action-type.js mongodb:/tmp/migrate-project-action-type.js
//   docker exec mongodb mongosh goplantatree --username admin --password password --authenticationDatabase admin --file /tmp/migrate-project-action-type.js
//
// How to run on the production server:
//   scp ./scripts/migrate-project-action-type.js user@server:/tmp/
//   ssh user@server "docker cp /tmp/migrate-project-action-type.js goplantatree-mongo:/tmp/migrate-project-action-type.js && docker exec goplantatree-mongo mongosh goplantatree --file /tmp/migrate-project-action-type.js"

print('=== PROJECT ACTION-TYPE MIGRATION ===\n');

let updated = 0;

db.projects.find({}).forEach(project => {
    const updates = {};
    const unsets = {};

    if (!project.actionType) {
        // Derive from old actionPath if possible, else default to 'bestellen'
        if (project.actionPath && project.actionPath.startsWith('/mitmachen/')) {
            updates.actionType = 'mitmachen';
        } else if (project.actionPath && project.actionPath.startsWith('/anmelden/')) {
            updates.actionType = 'anmelden';
        } else {
            updates.actionType = 'bestellen';
        }
    }

    if ('actionPath' in project) {
        unsets.actionPath = '';
    }

    const op = {};
    if (Object.keys(updates).length > 0) op.$set = updates;
    if (Object.keys(unsets).length > 0) op.$unset = unsets;

    if (Object.keys(op).length > 0) {
        db.projects.updateOne({ _id: project._id }, op);
        print(`  ✓ ${project.name} (${project.slug}) -> actionType: "${updates.actionType || project.actionType}"`);
        updated++;
    }
});

print(`\nDone. Migrated ${updated} projects.`);
