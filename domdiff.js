let lastNodeId = 0;

let MpathyDom = function (domRoot) {
  let nodeCache = {};

  function prepareNode(sourceNode, parentNode) {
    let nodeId = sourceNode.mptNodeId;
    if (typeof nodeId === "undefined") {
      nodeId = lastNodeId;
      sourceNode.mptNodeId = nodeId;
      lastNodeId++;
    }
    
    let node = sourceNode.cloneNode(false);
    nodeCache[nodeId] = node;
    node.mptNodeId = nodeId;
    node.mptChildIds = [];
    node.mptNextSiblingId = null;
    node.mptPreviousSiblingId = null;

    if (parentNode) {
      node.mptParentId = parentNode.mptNodeId;
      parentNode.mptChildIds.push(nodeId);
      parentNode.appendChild(node);

    }

    if (node.previousSibling) {
      node.mptPreviousSiblingId = node.previousSibling.mptNodeId;
      node.previousSibling.mptNextSiblingId = nodeId;
    }

    Array.from(sourceNode.childNodes || []).forEach(childNode => {
      prepareNode(childNode, node);
    });

    return node;
  }

  this.getRoot = () => {
    return domRoot;
  };

  this.getNodeById = nodeId => {
    return nodeCache[nodeId] || null;
  };

  domRoot = prepareNode(domRoot);
};

let DomDiff = function() {
  let currentDom = new MpathyDom(document.documentElement.parentNode);
  let oldDom;

  this.newSnapshot = () => {
    let startAt = performance.now();

    oldDom = currentDom;
    currentDom = new MpathyDom(document.documentElement.parentNode);

    let mutation = diffNodes(currentDom.getRoot(), oldDom.getRoot(), {
      r: [],
      am: [],
      t: [],
      cN: []
    });

    if (mutation.r.length === 0) {
      delete mutation.r;
    }
    if (mutation.am.length === 0) {
      delete mutation.am;
    }
    if (mutation.t.length === 0) {
      delete mutation.t;
    }
    if (mutation.cN.length === 0) {
      delete mutation.cN;
    }

    console.log(`DOM diff took ${performance.now() - startAt}ms`);
    console.log(`DOM HTML size: ${document.documentElement.innerHTML.length}`);
    console.log(`mutation size: ${JSON.stringify(mutation).length}`);

    return mutation;
  };

  function diffNodes(currentNode, oldNode, mutation) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      if (currentNode.textContent !== oldNode.textContent) {
        mutation.t.push({ id: currentNode.mptNodeId, tC: currentNode.textContent });
      }
      return;
    }
    
    let newChildNodes = currentNode.mptChildIds.filter(nodeId => !oldNode.mptChildIds.includes(nodeId));
    let removedChildNodes = oldNode.mptChildIds.filter(nodeId => !currentNode.mptChildIds.includes(nodeId));

    if (newChildNodes.length) {
      newChildNodes.forEach(childNodeId => {
        serializeNode(currentDom.getNodeById(childNodeId), mutation);
      });
    }
    if (removedChildNodes.length) {
      mutation.r = mutation.r.concat(removedChildNodes);
    }

    let changedAttributes = {};
    Array.from(currentNode.attributes || []).forEach(attribute => {
      if (attribute.value !== oldNode.getAttribute(attribute.name)) {
        changedAttributes[attribute.name] = attribute.value;
      }
    });
    Array.from(oldNode.attributes || []).forEach(attribute => {
      if (!currentNode.hasAttribute(attribute.name)) {
        changedAttributes[attribute.name] = null;
      }
    });

    if (Object.keys(changedAttributes).length) {
      mutation.am.push({ id: currentNode.mptNodeId , at: changedAttributes });
    }

    Array.from(currentNode.childNodes || []).forEach(currentChildNode => {
      if (newChildNodes.includes(currentChildNode.mptNodeId) || removedChildNodes.includes(currentChildNode.mptNodeId)) {
        return;
      }
      let oldChildNode = oldDom.getNodeById(currentChildNode.mptNodeId);
      if (oldChildNode) {
        diffNodes(currentChildNode, oldChildNode, mutation);
      }
    });

    return mutation;
  }

  function serializeNode(sourceNode, mutation) {
    let node = {
      id: sourceNode.mptNodeId,
      pN: sourceNode.mptParentId,
      nS: sourceNode.mptPreviousSiblingId
    };

    if (sourceNode.nodeType === Node.TEXT_NODE) {
      node.tC = sourceNode.textContent;
    } else {
      node.tN = sourceNode.tagName;

      let attributes = {};
      Array.from(sourceNode.attributes || []).forEach(attribute => {
        attributes[attribute.name] = attribute.value;
      });

      if (Object.keys(attributes).length) {
        node.at = attributes;
      }
    }

    mutation.cN.push(node);

    Array.from(sourceNode.childNodes || []).forEach(childNode => {
      serializeNode(childNode, mutation);
    });
  }
};

setTimeout(() => {
  window.domDiff = new DomDiff();
}, 5);
