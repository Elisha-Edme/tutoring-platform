// TEMPORARY: with USE_PROD_ENV=1 a Preview deploy reads PROD_<NAME> instead of <NAME>,
// so the prod credentials can be verified before Production is switched over.
// In this mode there is deliberately no fallback to the unprefixed var.
export function credential(name: string): string | undefined {
  return process.env.USE_PROD_ENV === '1' ? process.env[`PROD_${name}`] : process.env[name]
}
