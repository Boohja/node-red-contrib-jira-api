const { apiPost } = require("./helpers/api");
const { copyToNodeProp, convertInputToJson } = require("./helpers/nodes");

module.exports = function (RED) {
  function CreateIssueNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.credentials = RED.nodes.getCredentials(config.server);

    copyToNodeProp(node, "params", config, [
      "project",
      "summary",
      "description",
      "issuetype",
      "labels",
      "components",
      "fields",
      "properties",
      "update",
      "historyMetadata",
    ]);

    node.on("input", async function (msg) {
      node.status({ fill: "gray", shape: "dot", text: "Starting" });

      const fields = {};
      fields.project = { key: msg.project || node.params.project };
      fields.summary = msg.summary || node.params.summary;
      if (msg.description || node.params.description) {
        fields.description = msg.description || node.params.description;
      }
      fields.issuetype = {
        name: msg.issuetype || node.params.issuetype || "Task",
      };

      const labelsStr = msg.labels || node.params.labels;
      if (labelsStr) {
        fields.labels = labelsStr
          .split(",")
          .map((l) => l.trim())
          .filter((l) => l);
      }

      const componentsStr = msg.components || node.params.components;
      if (componentsStr) {
        fields.components = componentsStr
          .split(",")
          .map((c) => ({ name: c.trim() }))
          .filter((c) => c.name);
      }

      let advancedFields = {};
      try {
        advancedFields =
          convertInputToJson(msg.fields, node.params.fields) || {};
      } catch (error) {
        msg.error = `Could not parse advanced fields: ${error.message}`;
        return node.send([null, msg]);
      }

      Object.assign(fields, advancedFields);

      const bodyObject = { fields };

      try {
        const properties = convertInputToJson(
          msg.properties,
          node.params.properties
        );
        if (properties) bodyObject.properties = properties;
      } catch (error) {
        msg.error = `Could not parse properties: ${error.message}`;
        return node.send([null, msg]);
      }

      try {
        const update = convertInputToJson(msg.update, node.params.update);
        if (update) bodyObject.update = update;
      } catch (error) {
        msg.error = `Could not parse update: ${error.message}`;
        return node.send([null, msg]);
      }

      try {
        const historyMetadata = convertInputToJson(
          msg.historyMetadata,
          node.params.historyMetadata
        );
        if (historyMetadata) bodyObject.historyMetadata = historyMetadata;
      } catch (error) {
        msg.error = `Could not parse historyMetadata: ${error.message}`;
        return node.send([null, msg]);
      }

      try {
        msg.payload = await apiPost(node.credentials, `/issue`, {}, bodyObject);
        node.status({ fill: "green", shape: "dot", text: "Done" });
        node.send([msg, null]);
      } catch (error) {
        msg.error = `Unexpected error: ${error.message}`;
        node.status({ fill: "red", shape: "dot", text: "Error" });
        node.send([null, msg]);
      }
    });
  }
  RED.nodes.registerType("jira-create-issue", CreateIssueNode);
};
