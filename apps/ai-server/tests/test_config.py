import logging
import unittest

from app.config import Settings, _warn_on_unexpected_mode


class WarnOnUnexpectedModeTests(unittest.TestCase):
    def test_logs_nothing_for_valid_modes(self):
        settings = Settings(
            scale_analysis_mode="model",
            stt_correction_mode="test",
            daily_summary_mode="model",
        )
        with self.assertNoLogs("app.config", level="WARNING"):
            _warn_on_unexpected_mode(settings)

    def test_is_case_and_whitespace_insensitive(self):
        settings = Settings(scale_analysis_mode=" Model ")
        with self.assertNoLogs("app.config", level="WARNING"):
            _warn_on_unexpected_mode(settings)

    def test_warns_on_typo(self):
        settings = Settings(scale_analysis_mode="modle")
        with self.assertLogs("app.config", level="WARNING") as captured:
            _warn_on_unexpected_mode(settings)
        self.assertIn("SCALE_ANALYSIS_MODE", captured.output[0])

    def test_warns_on_missing_model_option_for_stt_correction(self):
        settings = Settings(stt_correction_mode="empty")
        with self.assertLogs("app.config", level="WARNING") as captured:
            _warn_on_unexpected_mode(settings)
        self.assertIn("STT_CORRECTION_MODE", captured.output[0])


if __name__ == "__main__":
    unittest.main()
