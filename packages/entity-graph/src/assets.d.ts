declare module "@surrealdb/wasm/worker?worker" {
  const WorkerAgent: new () => Worker;
  export default WorkerAgent;
}
