import recast from "recast";
const b = recast.types.builders;
const { createFilter } = require("rollup-pluginutils");

export default function invariantPlugin(options = {} as any) {
  const filter = createFilter(options.include, options.exclude);

  return {
    transform(code: string, id: string) {
      if (!filter(id)) {
        return;
      }

      const ast = recast.parse(code, { parser: this });

      recast.visit(ast, {
        visitCallExpression(path) {
          this.traverse(path);
          const node = path.value;

          if (isCallWithLength(node, "invariant", 1)) {
            return b.conditionalExpression(
              makeNodeEnvTest(),
              b.callExpression.from({
                ...node,
                arguments: node.arguments.slice(0, 1),
              }),
              node,
            );
          }

          if (node.callee.type === "MemberExpression" &&
              isIdWithName(node.callee.object, "invariant") &&
              isIdWithName(node.callee.property, "warn")) {
            return b.logicalExpression("&&", makeNodeEnvTest(), node);
          }
        },

        visitNewExpression(path) {
          this.traverse(path);
          const node = path.value;
          if (isCallWithLength(node, "InvariantError", 0)) {
            return b.conditionalExpression(
              makeNodeEnvTest(),
              b.newExpression.from({
                ...node,
                arguments: [],
              }),
              node,
            );
          }
        }
      });

      return {
        code: recast.print(ast).code,
        map: null,
      };
    }
  };
}

function isIdWithName(node: any, name: string) {
  return node && node.type === "Identifier" && node.name === name;
}

function isCallWithLength(
  node: any,
  name: string,
  length: number,
) {
  return isIdWithName(node.callee, name) &&
    node.arguments.length > length;
}

function makeNodeEnvTest() {
  return b.binaryExpression(
    "===",
    b.memberExpression(
      b.memberExpression(
        b.identifier("process"),
        b.identifier("env")
      ),
      b.identifier("NODE_ENV"),
    ),
    b.stringLiteral("production"),
  );
}
