import PQueue from "p-queue";

export const namingQueue = new PQueue({ concurrency: 1 });
