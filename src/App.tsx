import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import './App.css'

enum CocomoProjectType {
  /**
   * Organic projects are typically small, simple, and straightforward. 
   * They are developed in a familiar, flexible environment with experienced teams and well-understood requirements.
   *
   *
   * Characteristics:
   * The team members have significant experience in similar projects.
   * The project requirements are well-understood and relatively stable.
   * The project does not involve strict constraints (like real-time systems or hardware integration).
   * Communication among team members is effective, and the team is well-coordinated.
   * There are few uncertainties or risks.
   *
   *
   * Examples:
   * Small business software.
   * Internal tools.
   * Accounting software.
   * Simple web applications.
   *
   */
  Organic = "Organic",
  /**
   * Semi-detached projects are intermediate in size and complexity. They involve elements of both organic and embedded projects.
   * The team might have a mix of experience, and the project requirements are somewhat flexible but involve more constraints than organic projects.
   *
   *
   * Characteristics:
   * The team may have moderate experience in the domain but may also include newer members.
   * The project has a balance of well-understood and more uncertain requirements.
   * There are more complex interactions between components compared to organic projects.
   * The development environment may be partially new, and there could be more integration challenges.
   *
   *
   * Examples:
   * Medium-scale web applications.
   * Utilities, or system programs with some level of complexity.
   *
   */
  SemiDetached = "SemiDetached",
  /**
   * Embedded projects are the most complex and constrained projects. 
   * They often involve strict hardware, software, or regulatory constraints, and may be mission-critical or real-time systems. 
   * These projects typically require specialized development environments and expertise.
   *
   * Characteristics:
   * The project involves tight coupling with hardware or low-level system programming.
   * The project has complex, non-flexible requirements that must be adhered to.
   * Teams may lack experience in some areas, or the project may involve new technologies or methodologies.
   * There are high levels of uncertainty and risk, along with regulatory, safety, or performance requirements.
   * May require real-time processing or extensive testing.
   *
   *
   * Examples:
   * Aerospace software.
   * Military systems.
   * Real-time embedded systems 
   * Medical device software, or complex operating systems.
   *
   */
  Embedded = "Embedded",
}

function CocomoProjectTypeFromString(str: string): CocomoProjectType {
  if (Object.values(CocomoProjectType).includes(str as CocomoProjectType)) {
    return str as CocomoProjectType;
  }
  throw new Error(`Not found project type from ${str} string`)
}

// a and b used to estimate the effort of project
// c and d used to estimate the time of project
type CocomoEstimationСoefficients = {
  a: number  // a - represents how much effort is needed initially for a project of a given type and size
  b: number  // b - determines how effort grows as the project size (KLOC) increases

  c: number  // c - the time required to complete the project. It adjusts how the effort translates into development time
  d: number  // d - determines how the development time grows based on the effort.
}

type CocomoEstimationResult = {
  personMonths: number,  // PM - Effort in person-months
  timeInMonths: number,  // TM - Time required in months
  staffSize: number,     // SS - Number of staff required
  productivity: number   // P - Productivity factor
  effortAdjustmentFactor?: number,   // EAF - Effort Adjustment Factor
}

interface ICocomoEstimator {
  // 1,000 is 1 KLOC
  estimate(
    linesOfCode: number,  // KLOC - Kilo Lines of Code 
  ): CocomoEstimationResult
}

function round(num: number) {
  return Math.round(num * 100) / 100;
}

class CocomoBasic implements ICocomoEstimator {
  constructor(
    protected projectType: CocomoProjectType,
  ) { }

  protected coefficient: Map<CocomoProjectType, CocomoEstimationСoefficients> = new Map([
    [CocomoProjectType.Organic, { a: 2.4, b: 1.05, c: 2.5, d: 0.38 },],
    [CocomoProjectType.SemiDetached, { a: 3.0, b: 1.12, c: 2.5, d: 0.35 },],
    [CocomoProjectType.Embedded, { a: 3.6, b: 1.2, c: 2.5, d: 0.32 },],
  ])

  protected getCoefficient(projectType: CocomoProjectType): CocomoEstimationСoefficients {
    const result = this.coefficient.get(projectType);
    if (!result) throw new Error("Not found coefficient of types")
    return result
  }

  // E=a*(KLOC)^b
  estimateEffort(linesOfCode: number): number {
    const { a, b } = this.getCoefficient(this.projectType)
    return a * Math.pow(linesOfCode, b)
  }

  // T=c*(E)^d
  estimateTime(effort: number): number {
    const { c, d } = this.getCoefficient(this.projectType)
    return c * Math.pow(effort, d)
  }

  estimate(linesOfCode: number): CocomoEstimationResult {
    const personMonthEffort = this.estimateEffort(linesOfCode)
    const personTimeInMonthEffort = this.estimateTime(personMonthEffort)
    // S=E/T
    const sizeOfProject = personMonthEffort / personTimeInMonthEffort
    // P=S/E
    const productivity = linesOfCode / personMonthEffort
    return {
      personMonths: round(personMonthEffort),
      timeInMonths: round(personTimeInMonthEffort),
      staffSize: round(sizeOfProject),
      productivity: round(productivity),
    }
  }
}


type Rating = {
  very_low: number | null;
  low: number | null;
  nominal: number | null;
  high: number | null;
  very_high: number | null;
  extra_high: number | null;
}

type CostDriver = {
  name: string;
  desc: string;
  rating: Rating;
}

class CocomoIntermediate extends CocomoBasic {
  constructor(
    protected costDrivers: Array<number | null>,
    protected projectType: CocomoProjectType,
  ) {
    super(
      projectType,
    )
  }

  override coefficient: Map<CocomoProjectType, CocomoEstimationСoefficients> = new Map([
    [CocomoProjectType.Organic, { a: 3.2, b: 1.05, c: 2.5, d: 0.38 },],
    [CocomoProjectType.SemiDetached, { a: 3.0, b: 1.12, c: 2.5, d: 0.35 },],
    [CocomoProjectType.Embedded, { a: 2.8, b: 1.2, c: 2.5, d: 0.32 },],
  ])

  override estimate(linesOfCode: number): CocomoEstimationResult {
    let effortAdjustmentFactor = 1.0

    for (const driver of this.costDrivers) {
      if (!driver) continue
      effortAdjustmentFactor *= driver
    }

    const personMonthEffort = this.estimateEffort(linesOfCode) * effortAdjustmentFactor
    const personTimeInMonthEffort = this.estimateTime(personMonthEffort)
    // S=E/T
    const sizeOfProject = personMonthEffort / personTimeInMonthEffort
    // P=S/E
    const productivity = linesOfCode / personMonthEffort
    return {
      personMonths: round(personMonthEffort),
      timeInMonths: round(personTimeInMonthEffort),
      staffSize: round(sizeOfProject),
      productivity: round(productivity),
      effortAdjustmentFactor: round(effortAdjustmentFactor),
    }
  }
}

const costDrivers: CostDriver[] = [
  {
    name: "RELY",
    desc: "Required software reliability",
    rating: {
      very_low: 0.75,
      low: 0.88,
      nominal: 1.00,
      high: 1.15,
      very_high: 1.40,
      extra_high: null
    }
  },
  {
    name: "DATA",
    desc: "Size of application database",
    rating: {
      very_low: null,
      low: 0.94,
      nominal: 1.00,
      high: 1.08,
      very_high: 1.16,
      extra_high: null
    }
  },
  {
    name: "CPLX",
    desc: "Complexity of the product",
    rating: {
      very_low: 0.70,
      low: 0.85,
      nominal: 1.00,
      high: 1.15,
      very_high: 1.30,
      extra_high: 1.65
    }
  },
  {
    name: "TIME",
    desc: "Run-time performance constraints",
    rating: {
      very_low: null,
      low: null,
      nominal: 1.00,
      high: 1.11,
      very_high: 1.30,
      extra_high: 1.66
    }
  },
  {
    name: "STOR",
    desc: "Memory constraints",
    rating: {
      very_low: null,
      low: null,
      nominal: 1.00,
      high: 1.06,
      very_high: 1.21,
      extra_high: 1.56
    }
  },
  {
    name: "VIRT",
    desc: "Volatility of the virtual machine environment",
    rating: {
      very_low: null,
      low: 0.87,
      nominal: 1.00,
      high: 1.15,
      very_high: 1.30,
      extra_high: null
    }
  },
  {
    name: "TURN",
    desc: "Required turnabout time",
    rating: {
      very_low: null,
      low: 0.87,
      nominal: 1.00,
      high: 1.07,
      very_high: 1.15,
      extra_high: null
    }
  },
  {
    name: "ACAP",
    desc: "Analyst capability",
    rating: {
      very_low: 1.46,
      low: 1.19,
      nominal: 1.00,
      high: 0.86,
      very_high: 0.71,
      extra_high: null
    }
  },
  {
    name: "AEXP",
    desc: "Applications experience",
    rating: {
      very_low: 1.29,
      low: 1.13,
      nominal: 1.00,
      high: 0.91,
      very_high: 0.82,
      extra_high: null
    }
  },
  {
    name: "PCAP",
    desc: "Software engineer capability",
    rating: {
      very_low: 1.42,
      low: 1.17,
      nominal: 1.00,
      high: 0.86,
      very_high: 0.70,
      extra_high: null
    }
  },
  {
    name: "VEXP",
    desc: "Virtual machine experience",
    rating: {
      very_low: 1.21,
      low: 1.10,
      nominal: 1.00,
      high: 0.90,
      very_high: null,
      extra_high: null
    }
  },
  {
    name: "LEXP",
    desc: "desc",
    rating: {
      very_low: 1.14,
      low: 1.07,
      nominal: 1.00,
      high: 0.95,
      very_high: null,
      extra_high: null
    }
  },
  {
    name: "MODP",
    desc: "Application of software engineering methods",
    rating: {
      very_low: 1.24,
      low: 1.10,
      nominal: 1.00,
      high: 0.91,
      very_high: 0.82,
      extra_high: null
    }
  },
  {
    name: "TOOL",
    desc: "Use of software tools",
    rating: {
      very_low: 1.24,
      low: 1.10,
      nominal: 1.00,
      high: 0.91,
      very_high: 0.83,
      extra_high: null
    }
  },
  {
    name: "SCED",
    desc: "Required development schedule",
    rating: {
      very_low: 1.23,
      low: 1.08,
      nominal: 1.00,
      high: 1.04,
      very_high: 1.10,
      extra_high: null
    }
  }
];

function CocomoResultApp({ result }: { result: CocomoEstimationResult | undefined }) {
  if (!result)
    return null
  return (
    <div>
      <h2>PM(Effort in person-months) - {result.personMonths}</h2>
      <h2>TM(Time requred in months) - {result.timeInMonths}</h2>
      <h2>SS(Number of staff required) - {result.staffSize}</h2>
      <h2>P(Productivity factor) - {result.productivity}</h2>
      <h2>EAF(Effort Adjustment Factor) - {result.effortAdjustmentFactor || 'null'}</h2>
    </div>
  )
}


const basicCocomoAppFormSchema = z.object({
  kloc: z.string().min(1, {
    message: "Lines of code must be at least 1 digit",
  }),
})

function BasicCocomoApp() {
  const [projectType, setProjectType] = useState<CocomoProjectType>(CocomoProjectType.Organic)
  const [cocomoResult, setCocomoResult] = useState<CocomoEstimationResult>()

  const cocomoBasic = useMemo(() => new CocomoBasic(projectType), [projectType])

  const form = useForm<z.infer<typeof basicCocomoAppFormSchema>>({
    resolver: zodResolver(basicCocomoAppFormSchema),
  })

  const onSubmit = useCallback((values: z.infer<typeof basicCocomoAppFormSchema>) => {
    const kloc = parseInt(values.kloc)
    if (!kloc) {
      // TODO: How to validate number ?
      throw new Error("Numer")
    }
    setCocomoResult(cocomoBasic.estimate(kloc))
  }, [cocomoBasic])

  return (
    <div className='m-auto w-[55%]'>

      <Select defaultValue={projectType} onValueChange={(val) => setProjectType(CocomoProjectTypeFromString(val))}>
        <SelectTrigger className="">
          <SelectValue placeholder="Project type" />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(CocomoProjectType).map(projectTypeName => {
            return (
              <SelectItem key={`${projectTypeName}-BasicCocomoApp`} value={projectTypeName}>
                {projectTypeName}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
          <FormField
            control={form.control}
            name="kloc"
            render={({ field }) => (
              <FormItem className='py-2'>

                <FormMessage />
                <FormControl>
                  <Input placeholder="Enter a kloc" type='number' {...field} />
                </FormControl>

              </FormItem>
            )}
          />
          <Button type="submit">Submit</Button>
        </form>
      </Form>
      <CocomoResultApp result={cocomoResult} />
    </div>
  )
}

const intermediateCocomoAppFormSchema = z.object({
  // kloc: z.string().min(1, {
  //   message: "Lines of code must be at least 1 digit",
  // }),
  kloc: z.preprocess((val) => parseInt(val as string), z.number().min(1, {
    message: "Lines of code must be at least 1 digit",
  })),
  costDrivers: z.object({
    RELY: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    DATA: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    CPLX: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    TIME: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    STOR: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    VIRT: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    TURN: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    ACAP: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    AEXP: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    PCAP: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    VEXP: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    LEXP: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    MODP: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    TOOL: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
    SCED: z.preprocess((val) => parseFloat(val as string), z.number().nullable()),
  }),
})

function IntermediateCocomoApp() {
  const [projectType, setProjectType] = useState<CocomoProjectType>(CocomoProjectType.Organic)
  const [cocomoResult, setCocomoResult] = useState<CocomoEstimationResult>()

  const form = useForm<z.infer<typeof intermediateCocomoAppFormSchema>>({
    resolver: zodResolver(intermediateCocomoAppFormSchema),
  })

  useEffect(() => {
  }, [])

  const onSubmit = useCallback((values: z.infer<typeof intermediateCocomoAppFormSchema>) => {
    const cocomoEstimator = new CocomoIntermediate(Object.values(values.costDrivers), projectType)
    setCocomoResult(cocomoEstimator.estimate(values.kloc))
  }, [projectType])

  return (
    <div className='m-auto w-[55%]'>

      <div className='py-2'>
        <CocomoResultApp result={cocomoResult} />
      </div>

      <Select defaultValue={projectType} onValueChange={(val) => setProjectType(CocomoProjectTypeFromString(val))}>
        <SelectTrigger className="">
          <SelectValue placeholder="Project type" />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(CocomoProjectType).map(projectTypeName => {
            return (
              <SelectItem key={`${projectTypeName}-IntermediateCocomoApp`} value={projectTypeName}>
                {projectTypeName}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
          <FormField
            control={form.control}
            name="kloc"
            render={({ field }) => (
              <FormItem className='py-2'>
                <FormLabel>Enter KLOC</FormLabel>
                <FormControl>
                  <Input placeholder="Enter a kloc" type='number' {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <Button className='py-2' type="submit">Submit</Button>

          <div className='flex flex-row flex-wrap gap-4'>
            {costDrivers.map((driver, idx) => (
              <FormField
                key={`${driver.name}-${idx}`}
                control={form.control}
                // @ts-ignore
                name={`costDrivers.${driver.name}`}
                // @ts-ignore
                defaultValue={driver.rating.nominal}
                render={({ field }) => (
                  <FormItem className='w-[140px]'>
                    <FormLabel>{`costDrivers.${driver.name}`}</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(val) => field.onChange(val)}
                        // @ts-ignore
                        defaultValue={field.value?.toString()}
                      >
                        <SelectTrigger className="">
                          <SelectValue placeholder={"N/A"} defaultValue={null} />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(driver.rating).map(([key, value]) => (
                            <SelectItem key={`costDrivers.${driver.name}-${key}-${value}`}
                              // @ts-ignore
                              value={value ? value.toString() : null}>
                              {key} - {value ?? "N/A"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
          </div>

        </form>
      </Form>
    </div>
  )
}

function App() {
  return (
    <div>
      <h1>Basic</h1>
      <BasicCocomoApp />
      <h1>Intermediate</h1>
      <IntermediateCocomoApp />
    </div>
  )
}

export default App
