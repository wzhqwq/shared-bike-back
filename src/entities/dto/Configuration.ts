import { Column, Entity, Id, Nullable } from "../entity";

@Entity("Configuration")
export class Configuration {
  @Id
  @Nullable
  @Column(Number)
  public id: number

  @Column(String)
  public key: string

  @Column(Number)
  public value: number
}