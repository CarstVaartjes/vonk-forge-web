import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export function trackedSources(root) {
  return new Map(execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0").filter(Boolean).map((file) => [file, readFileSync(path.join(root, file), "utf8")]));
}

export function registrations(files) {
  return [...files].filter(([file]) => file.endsWith(".single-source.json"))
    .flatMap(([, source]) => JSON.parse(source));
}

function syntax(file, source) {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
}

function visit(node, inspect) {
  inspect(node);
  ts.forEachChild(node, (child) => visit(child, inspect));
}

function checkNode(files, entry, report) {
  const value = files.get(entry.owner.file)?.trim();
  if (entry.owner.selector !== "semver" || !/^\d+\.\d+\.\d+$/.test(value ?? "")) {
    report(entry.owner.file, 1, "missing or invalid semver owner");
  }
  // Match the selection context, not the current version: stale/new pins fail too.
  const selection = /(?:node-version\s*:|\bNODE_VERSION\s*[:=]|\bnode(?:js)?_version\s*[:=]|\bnode@|\bFROM\s+node:|\bNode(?:\.js)?(?:\s+is)?\s+\**[v~^]?)([\s"'`]*[v~^]?\d+(?:\.\d+){0,2}(?:\.x)?)/gi;
  for (const [file, source] of files) {
    if (file === entry.owner.file) continue;
    if ([".nvmrc", ".node-version", "web/.node-version", "web/.nvmrc"].includes(file)) {
      report(file, 1, "independent Node version file");
    }
    if (file.endsWith("package.json")) {
      const metadata = JSON.parse(source);
      if (metadata.engines?.node || metadata.volta?.node) report(file, 1, "derive Node tooling selection from the owner");
    }
    let region;
    for (const [offset, line] of source.split("\n").entries()) {
      const marker = line.match(/^\s*\/\/ single-source-adversarial-(begin|end): ([\w-]+)\s*$/);
      if (marker) {
        const allowed = entry.adversarial?.some((item) => item.file === file && item.region === marker[2]);
        if (!allowed || (marker[1] === "begin" ? region : region !== marker[2])) {
          report(file, offset + 1, "unregistered or overlapping adversarial region");
        }
        region = marker[1] === "begin" && allowed ? marker[2] : undefined;
        continue;
      }
      if (region) continue;
      for (const match of line.matchAll(selection)) report(file, offset + 1, `handwritten Node selection ${match[0].trim()}`);
      if (/node-version-file\s*:/.test(line) && !new RegExp(`node-version-file:\\s*["']?${entry.owner.file.replaceAll(".", "\\.")}["']?\\s*$`).test(line)) {
        report(file, offset + 1, `version file must be ${entry.owner.file}`);
      }
    }
    if (region) report(file, source.split("\n").length, "unterminated adversarial region");
  }
  for (const consumer of entry.consumers) {
    const source = files.get(consumer.file) ?? "";
    if (consumer.selector === "setup-node") {
      const steps = source.split(/(?=^\s*- uses:)/m).filter((step) => /uses: actions\/setup-node@/.test(step));
      if (!steps.length || steps.some((step) => !step.includes(`node-version-file: ${entry.owner.file}`))) {
        report(consumer.file, 1, "setup-node must read the owner via node-version-file");
      }
    } else if (consumer.selector === "runtime-check") {
      // Verify the executable reader, not a marker claiming it was generated.
      const ast = syntax(consumer.file, source);
      let readsOwner = false;
      visit(ast, (node) => {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === "readFileSync"
          && ts.isNewExpression(node.arguments[0]) && node.arguments[0].expression.getText(ast) === "URL"
          && ts.isStringLiteral(node.arguments[0].arguments?.[0])) {
          readsOwner ||= path.posix.normalize(path.posix.join(path.posix.dirname(consumer.file), node.arguments[0].arguments[0].text)) === entry.owner.file;
        }
      });
      if (!readsOwner) report(consumer.file, 1, "runtime check must read the owner");
    } else report(consumer.file, 1, `unknown consumer selector ${consumer.selector}`);
  }
}

function checkMemory(files, entry, report) {
  let owners = 0;
  let projections = 0;
  for (const [file, source] of files) {
    if (!/\.(?:[cm]?js|tsx?)$/.test(file)) continue;
    const ast = syntax(file, source);
    visit(ast, (node) => {
      if (file === entry.owner.file && ts.isFunctionDeclaration(node) && node.name?.text === entry.owner.selector) owners++;
      const field = ts.isPropertyAccessExpression(node) ? node.name.text
        : ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : undefined;
      if (field !== "peak_bytes" && field !== "reserve_bytes") return;
      const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      let scope = node.parent;
      while (scope && !ts.isFunctionDeclaration(scope)) scope = scope.parent;
      if (file !== entry.owner.file || scope?.name?.text !== entry.owner.selector) {
        report(file, line, `independent memory projection reads ${field}`);
      } else if (field === "reserve_bytes") {
        report(file, line, "reserve is informational; project peak only");
      } else {
        projections++;
        // The sole projection must use the contract field directly, with no arithmetic.
        const call = node.parent;
        const declaration = call.parent;
        if (!ts.isCallExpression(call) || call.expression.getText(ast) !== "number"
          || !ts.isVariableDeclaration(declaration) || declaration.initializer !== call) {
          report(file, line, "project peak_bytes directly through number()");
        }
      }
    });
  }
  if (owners !== 1) report(entry.owner.file, 1, `expected the single function owner ${entry.owner.selector}`);
  if (projections !== 1) report(entry.owner.file, 1, "expected exactly one peak_bytes projection in the owner");
}

export function checkSingleSources(files, entries = registrations(files)) {
  const errors = [];
  const ids = new Set();
  const owners = new Set();
  const classes = new Set();
  const kinds = { "node-version": checkNode, "memory-projection": checkMemory };
  for (const entry of entries) {
    const owner = `${entry.owner?.file}#${entry.owner?.selector}`;
    const report = (file, line, detail) => errors.push(`${entry.id}: ${file}:${line}: ${detail}; owner ${owner}; ${entry.derive}`);
    if (!entry.id || !entry.owner?.file || !entry.owner?.selector || !entry.derive || !files.has(entry.owner.file)) {
      report(entry.owner?.file, 1, "missing owner selector or derivation");
      continue;
    }
    if (ids.has(entry.id) || owners.has(owner) || classes.has(entry.kind)) report(entry.owner.file, 1, "duplicate or overlapping owner registration");
    ids.add(entry.id);
    owners.add(owner);
    classes.add(entry.kind);
    const check = kinds[entry.kind];
    if (!check) report(entry.owner.file, 1, `unregistered class ${entry.kind}`);
    else check(files, entry, report);
  }
  return errors;
}
