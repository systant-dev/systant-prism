// jsdom has no canvas, and reports every getContext as not implemented. Null is
// what code gets where there is none; a test that wants one spies on it.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
