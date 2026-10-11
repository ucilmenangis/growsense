/** LMS rows flattened as [L, M, S, L, M, S, ...], one row per step from `start`. */
export interface LmsTable {
  start: number
  step: number
  male: number[]
  female: number[]
}

export interface Lms {
  l: number
  m: number
  s: number
}
