import { profile } from "../config.ts";

export interface ContributionDay {
  date: string;
  contributionCount: number;
  weekday: number;
}

export interface LanguageTotal {
  name: string;
  color: string;
  bytes: number;
  repositories: number;
}

export interface ProfileStats {
  totalContributions: number;
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
  repositories: number;
  stars: number;
  forks: number;
  days: ContributionDay[];
  languages: LanguageTotal[];
}

interface GraphQLResponse {
  data?: {
    user: {
      contributionsCollection: {
        totalCommitContributions: number;
        totalIssueContributions: number;
        totalPullRequestContributions: number;
        totalPullRequestReviewContributions: number;
        restrictedContributionsCount: number;
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{
            contributionDays: ContributionDay[];
          }>;
        };
      };
      repositories: {
        totalCount: number;
        nodes: Array<{
          stargazerCount: number;
          forkCount: number;
          languages: {
            edges: Array<{
              size: number;
              node: {
                name: string;
                color: string | null;
              };
            }>;
          };
        }>;
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
}

const query = `
  query Profile($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              weekday
            }
          }
        }
      }
      repositories(
        first: 100
        privacy: PUBLIC
        ownerAffiliations: OWNER
        isFork: false
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        totalCount
        nodes {
          stargazerCount
          forkCount
          languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;

export const fetchProfileStats = async (): Promise<ProfileStats> => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required to generate live statistics.");
  }

  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 364);

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": `${profile.username}-profile-generator`,
    },
    body: JSON.stringify({
      query,
      variables: {
        login: profile.username,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as GraphQLResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  const user = payload.data?.user;
  if (!user) {
    throw new Error(`GitHub user "${profile.username}" was not found.`);
  }

  const collection = user.contributionsCollection;
  const languageMap = new Map<
    string,
    { color: string; bytes: number; repositories: number }
  >();

  let stars = 0;
  let forks = 0;

  for (const repository of user.repositories.nodes) {
    stars += repository.stargazerCount;
    forks += repository.forkCount;

    const languagesInRepository = new Set<string>();
    for (const edge of repository.languages.edges) {
      const existing = languageMap.get(edge.node.name) ?? {
        color: edge.node.color ?? "#a855f7",
        bytes: 0,
        repositories: 0,
      };
      existing.bytes += edge.size;
      if (!languagesInRepository.has(edge.node.name)) {
        existing.repositories += 1;
        languagesInRepository.add(edge.node.name);
      }
      languageMap.set(edge.node.name, existing);
    }
  }

  const languages = [...languageMap.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    totalContributions: collection.contributionCalendar.totalContributions,
    commits:
      collection.totalCommitContributions +
      collection.restrictedContributionsCount,
    pullRequests: collection.totalPullRequestContributions,
    issues: collection.totalIssueContributions,
    reviews: collection.totalPullRequestReviewContributions,
    repositories: user.repositories.totalCount,
    stars,
    forks,
    days: collection.contributionCalendar.weeks.flatMap(
      (week) => week.contributionDays,
    ),
    languages,
  };
};
