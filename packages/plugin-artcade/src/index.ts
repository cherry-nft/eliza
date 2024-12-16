import { Plugin } from "@ai16z/eliza";
import { EVOLVE, ANALYZE_PATTERN } from "./actions";

export const artcadePlugin: Plugin = {
    name: "artcade",
    description: "HTML evolution through arcade mechanics",
    actions: [EVOLVE, ANALYZE_PATTERN],
};
