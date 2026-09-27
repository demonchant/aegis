// Deliberately vulnerable demo fixture; never copy this authorization pattern.
function resolveRole(request, user) {
  return request.body.role || user.role;
}

module.exports = { resolveRole };
