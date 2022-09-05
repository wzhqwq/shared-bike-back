import { CheckBodyProperties } from "../../utils/body"

export type GeoPoint = {
  p_longitude: string
  p_latitude: string
}

export const geoPointParams: CheckBodyProperties<GeoPoint>[] = [
  { key: 'p_longitude', restrictions: ['geographical'] },
  { key: 'p_latitude', restrictions: ['geographical'] },
]

export type GeoArea = {
  tr_longitude: string
  tr_latitude: string
  bl_longitude: string
  bl_latitude: string
}

export const geoAreaParams: CheckBodyProperties<GeoArea>[] = [
  { key: 'tr_longitude', restrictions: ['geographical'] },
  { key: 'tr_latitude', restrictions: ['geographical'] },
  { key: 'bl_longitude', restrictions: ['geographical'] },
  { key: 'bl_latitude', restrictions: ['geographical'] },
]

