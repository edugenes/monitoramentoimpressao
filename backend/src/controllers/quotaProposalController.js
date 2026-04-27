const proposalService = require('../services/quotaProposalService');

function listProposals(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    res.json(proposalService.listProposals({ limit }));
  } catch (err) { next(err); }
}

function getProposalByPeriod(req, res, next) {
  try {
    const period = req.params.period;
    const proposal = proposalService.getProposalByPeriod(period);
    if (!proposal) return res.status(404).json({ error: true, message: 'Proposta nao encontrada' });
    res.json(proposal);
  } catch (err) { next(err); }
}

function getProposal(req, res, next) {
  try {
    const proposal = proposalService.getProposal(parseInt(req.params.id, 10));
    if (!proposal) return res.status(404).json({ error: true, message: 'Proposta nao encontrada' });
    res.json(proposal);
  } catch (err) { next(err); }
}

function generateProposal(req, res, next) {
  try {
    const period = req.body?.period || req.query.period || proposalService.getNextPeriod();
    const proposal = proposalService.generateProposal(period, req.user?.id);
    res.status(201).json(proposal);
  } catch (err) {
    if (err.message?.includes('aplicada')) {
      return res.status(400).json({ error: true, message: err.message });
    }
    next(err);
  }
}

function updateItem(req, res, next) {
  try {
    const proposalId = parseInt(req.params.id, 10);
    const itemId = parseInt(req.params.itemId, 10);
    const { approved_limit } = req.body || {};
    const proposal = proposalService.updateItemApprovedLimit(proposalId, itemId, approved_limit, req.user?.id);
    res.json(proposal);
  } catch (err) {
    if (err.message?.includes('aplicada') || err.message?.includes('nao encontrad')) {
      return res.status(400).json({ error: true, message: err.message });
    }
    next(err);
  }
}

function bulkUpdateItems(req, res, next) {
  try {
    const proposalId = parseInt(req.params.id, 10);
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    const proposal = proposalService.bulkUpdateItems(proposalId, updates, req.user?.id);
    res.json(proposal);
  } catch (err) {
    if (err.message?.includes('aplicada')) {
      return res.status(400).json({ error: true, message: err.message });
    }
    next(err);
  }
}

function fillSuggested(req, res, next) {
  try {
    const proposalId = parseInt(req.params.id, 10);
    const proposal = proposalService.fillApprovedFromSuggested(proposalId);
    res.json(proposal);
  } catch (err) {
    if (err.message?.includes('aplicada')) {
      return res.status(400).json({ error: true, message: err.message });
    }
    next(err);
  }
}

function approveProposal(req, res, next) {
  try {
    const proposalId = parseInt(req.params.id, 10);
    const proposal = proposalService.approveProposal(proposalId, req.user?.id);
    res.json(proposal);
  } catch (err) {
    if (err.message?.includes('aplicada')) {
      return res.status(400).json({ error: true, message: err.message });
    }
    next(err);
  }
}

function rejectProposal(req, res, next) {
  try {
    const proposalId = parseInt(req.params.id, 10);
    const proposal = proposalService.rejectProposal(proposalId, req.user?.id, req.body?.notes);
    res.json(proposal);
  } catch (err) {
    if (err.message?.includes('aplicada')) {
      return res.status(400).json({ error: true, message: err.message });
    }
    next(err);
  }
}

function deleteProposal(req, res, next) {
  try {
    const proposalId = parseInt(req.params.id, 10);
    res.json(proposalService.deleteProposal(proposalId));
  } catch (err) {
    if (err.message?.includes('aplicada') || err.message?.includes('nao encontrad')) {
      return res.status(400).json({ error: true, message: err.message });
    }
    next(err);
  }
}

module.exports = {
  listProposals,
  getProposalByPeriod,
  getProposal,
  generateProposal,
  updateItem,
  bulkUpdateItems,
  fillSuggested,
  approveProposal,
  rejectProposal,
  deleteProposal,
};
