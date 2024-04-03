import toJSON from "./tojson.json";
import { generateToReactCode } from "../src"

import type { ToJSON } from "@mybricks/render-types";

generateToReactCode(toJSON as ToJSON);

