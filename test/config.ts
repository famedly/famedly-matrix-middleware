import * as WhyRunning from "why-is-node-running";
import "mocha";

after(() => {
	WhyRunning();
});
