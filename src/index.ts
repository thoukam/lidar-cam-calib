import { ExtensionContext } from "@foxglove/extension";
 
import { initCalibPanel } from "./CalibPanel";
 
export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "lidar-cam-calib", initPanel: initCalibPanel });
}
 