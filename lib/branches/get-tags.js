import { escapeRegExp, template } from "lodash-es";
import semver from "semver";
import pReduce from "p-reduce";
import debugTags from "debug";
import { getTags, getTagsNotes } from "../../lib/git.js";

const debug = debugTags("semantic-release:get-tags");

export default async ({ cwd, env, options: { tagFormat } }, branches) => {
  // Generate a regex to parse tags formatted with `tagFormat`
  // by replacing the `version` variable in the template by `(.+)`.
  // The `tagFormat` is compiled with space as the `version` as it's an invalid tag character,
  // so it's guaranteed to no be present in the `tagFormat`.
  const tagRegexp = `^${escapeRegExp(template(tagFormat)({ version: " " })).replace(" ", "(.+)")}`;

  // Get the tags notes for all the tags in the repository
  const tagsNotesMap = await getTagsNotes({ cwd, env });

  return pReduce(
    branches,
    async (branches, branch) => {
      const branchTags = await pReduce(
        await getTags(branch.name, { cwd, env }),
        async (branchTags, tag) => {
          const [, version] = tag.match(tagRegexp) || [];
          const channels = tagsNotesMap.has(tag) ? tagsNotesMap.get(tag).channels : [null];
          return version && semver.valid(semver.clean(version))
            ? [...branchTags, { gitTag: tag, version, channels }]
            : branchTags;
        },
        []
      );

      debug("found tags for branch %s: %o", branch.name, branchTags);
      return [...branches, { ...branch, tags: branchTags }];
    },
    []
  );
};
