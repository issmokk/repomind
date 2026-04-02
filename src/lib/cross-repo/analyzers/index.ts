import type { AnalyzerRegistry } from '../analyzer-registry'
import { GemDependencyAnalyzer } from './gem-dependency'
import { NpmDependencyAnalyzer } from './npm-dependency'
import { RabbitMqEventFlowAnalyzer } from './rabbitmq-event'

export { GemDependencyAnalyzer } from './gem-dependency'
export { NpmDependencyAnalyzer } from './npm-dependency'
export { RabbitMqEventFlowAnalyzer } from './rabbitmq-event'

export function registerBuiltinAnalyzers(registry: AnalyzerRegistry): void {
  registry.register(new GemDependencyAnalyzer())
  registry.register(new NpmDependencyAnalyzer())
  registry.register(new RabbitMqEventFlowAnalyzer())
}
