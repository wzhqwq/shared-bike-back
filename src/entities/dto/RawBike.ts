export type RawBike = {
  id: number
  series_id: number
  p_longitude: number
  p_latitude: number
  status: number
  mileage: number
  health: number
  parking_section_id: number
  parking_point_id: number
}
export const rawBikeColumns: (keyof RawBike)[] = ['series_id', 'p_longitude', 'p_latitude', 'status', 'mileage',
  'health', 'parking_point_id', 'parking_section_id']