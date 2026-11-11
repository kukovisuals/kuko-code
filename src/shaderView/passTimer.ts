// Wraps draws in GPU timer queries and collects results on later frames. Asking for a result before
// it is available would make ANGLE wait for the GPU, so results are only read once they are ready.
import type { TimerQueryExt } from '../record/probeEnvironment';

interface PendingQuery<Tag> {
  query: WebGLQuery;
  tag: Tag;
}

export class PassTimer<Tag> {
  private pending: PendingQuery<Tag>[] = [];

  constructor(
    private gl: WebGL2RenderingContext,
    private ext: TimerQueryExt,
    private onResult: (tag: Tag, ms: number) => void,
  ) {}

  timed(tag: Tag, draw: () => void): void {
    const query = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    draw();
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push({ query, tag });
  }

  poll(): void {
    while (this.pending.length > 0) {
      const head = this.pending[0] as PendingQuery<Tag>;
      if (!this.gl.getQueryParameter(head.query, this.gl.QUERY_RESULT_AVAILABLE)) return;
      const nanoseconds = Number(this.gl.getQueryParameter(head.query, this.gl.QUERY_RESULT));
      this.gl.deleteQuery(head.query);
      this.pending.shift();
      this.onResult(head.tag, nanoseconds / 1e6);
    }
  }

  get pendingCount(): number {
    return this.pending.length;
  }
}
