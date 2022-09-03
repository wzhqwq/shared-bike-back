import { Column, Entity, Id, Nullable, Readonly } from "../entity";

@Entity("Configuration")
export class Configuration {
  @Id
  @Column(Number)
  public id: number

  @Column(String)
  @Nullable
  @Readonly
  public key: string

  @Column(Number)
  public value: number
}