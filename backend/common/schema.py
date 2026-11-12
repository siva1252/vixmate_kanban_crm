"""OpenAPI schema tweaks for Viximate CRM."""

from drf_spectacular.openapi import AutoSchema


class ViximateAutoSchema(AutoSchema):
    """Allow DELETE request bodies so Swagger shows required `reason` fields."""

    def _get_request_body(self, direction="request"):
        if self.method == "DELETE":
            original = self.method
            # spectacular only builds bodies for POST/PUT/PATCH; soft-deletes need a body.
            self.method = "POST"
            try:
                return super()._get_request_body(direction=direction)
            finally:
                self.method = original
        return super()._get_request_body(direction=direction)
