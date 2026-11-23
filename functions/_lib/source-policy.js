export const ALLOWED_UNIVERSITY_ROOTS = Object.freeze([
  'nus.edu.sg', 'ntu.edu.sg', 'hku.hk', 'cuhk.edu.hk', 'hkust.edu.hk',
  'cityu.edu.hk', 'polyu.edu.hk', 'smu.edu.sg', 'sutd.edu.sg',
  'ox.ac.uk', 'cam.ac.uk', 'imperial.ac.uk', 'ucl.ac.uk', 'lse.ac.uk',
  'ed.ac.uk', 'manchester.ac.uk', 'kcl.ac.uk', 'warwick.ac.uk',
  'mit.edu', 'stanford.edu', 'harvard.edu', 'yale.edu', 'princeton.edu',
  'cornell.edu', 'columbia.edu', 'berkeley.edu', 'ucla.edu', 'usc.edu',
  'umich.edu', 'gatech.edu', 'illinois.edu', 'utexas.edu', 'ucsd.edu',
  'ucdavis.edu', 'uci.edu', 'unc.edu', 'cmu.edu', 'northwestern.edu',
  'duke.edu', 'brown.edu', 'dartmouth.edu', 'rice.edu', 'nyu.edu',
  'utoronto.ca', 'ubc.ca', 'mcgill.ca', 'ualberta.ca', 'umontreal.ca',
  'unimelb.edu.au', 'sydney.edu.au', 'monash.edu', 'anu.edu.au',
  'snu.ac.kr', 'kaist.ac.kr', 'kyoto-u.ac.jp', 'u-tokyo.ac.jp',
  'tsinghua.edu.cn', 'pku.edu.cn', 'zju.edu.cn', 'sjtu.edu.cn',
  'ethz.ch', 'epfl.ch'
]);

// Activity sources are deliberately separate from university sources.  These
// are organiser domains already represented in Path's V78 activity catalogue;
// this is not a general-purpose web fetch allow-list.
export const ALLOWED_ACTIVITY_ROOTS = Object.freeze([
  'ieo-official.org', 'devpost.com', 'ioling.org', 'ipssingapore.org',
  'j-flec.go.jp', 'maa.org', 'sgmathsociety.org', 'usaco.org', 'apa.org',
  'ibo-info.org', 'icho-official.org', 'ipho-new.org',
  'johnlockeinstitute.com', 'kenchikushikai.or.jp', 'nias.ac.jp',
  'researchcomp.org', 'stat.go.jp', 'upenn.edu'
]);

export function isAllowedUniversityHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return ALLOWED_UNIVERSITY_ROOTS.some(root => host === root || host.endsWith(`.${root}`));
}

export function universityRootForHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return ALLOWED_UNIVERSITY_ROOTS.find(root => host === root || host.endsWith(`.${root}`)) || null;
}

export function parseAllowedUniversityUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('invalid_source_url');
  }
  if (
    url.protocol !== 'https:' || url.username || url.password || url.port ||
    !isAllowedUniversityHost(url.hostname)
  ) {
    throw new Error('source_not_allowed');
  }
  return url;
}

export function isAllowedActivityHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return isAllowedUniversityHost(host) || ALLOWED_ACTIVITY_ROOTS.some(root => host === root || host.endsWith(`.${root}`));
}

export function parseAllowedActivityUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('invalid_source_url');
  }
  if (
    url.protocol !== 'https:' || url.username || url.password || url.port ||
    !isAllowedActivityHost(url.hostname)
  ) {
    throw new Error('source_not_allowed');
  }
  return url;
}
