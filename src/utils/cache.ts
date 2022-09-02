import { Configuration } from "../entities/dto/Configuration";
import { Malfunction } from "../entities/dto/Malfunction";
import { BikeSeries } from "../entities/dto/RawBike";
import { DbEntity } from "../entities/entity";

const configDb = new DbEntity(Configuration)
const malfunctionDb = new DbEntity(Malfunction)
const seriesDb = new DbEntity(BikeSeries)

export const configs = configDb.list()
export const malfunctions = malfunctionDb.list()
export const series = seriesDb.list()

export async function getConfigValue(id: number) {
  return (await configs)[id].value
}