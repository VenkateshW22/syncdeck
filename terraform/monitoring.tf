# -----------------------------------------------------------------------
# terraform/monitoring.tf
#
# Cloud Monitoring alert policies and notification channels for SyncDeck.
# Alerts on: high CPU, high memory, error rate spikes, latency, DB connections.
# -----------------------------------------------------------------------

# ─── Notification Channel (Email) ─────────────────────────────────────────────
resource "google_monitoring_notification_channel" "ops_email" {
  display_name = "SyncDeck Ops Email"
  type         = "email"

  labels = {
    email_address = var.ops_alert_email
  }
}

# ─── Alert: High CPU Utilization ──────────────────────────────────────────────
resource "google_monitoring_alert_policy" "high_cpu" {
  display_name = "SyncDeck — High CPU Utilization"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run CPU > 85%"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.app_name}\" AND metric.type=\"run.googleapis.com/container/cpu/utilizations\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      duration        = "120s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_99"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.ops_email.name]
  severity              = "WARNING"

  alert_strategy {
    auto_close = "1800s"
  }
}

# ─── Alert: High Memory Utilization ───────────────────────────────────────────
resource "google_monitoring_alert_policy" "high_memory" {
  display_name = "SyncDeck — High Memory Utilization"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run Memory > 80%"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.app_name}\" AND metric.type=\"run.googleapis.com/container/memory/utilizations\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.80
      duration        = "120s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_99"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.ops_email.name]
  severity              = "WARNING"

  alert_strategy {
    auto_close = "1800s"
  }
}

# ─── Alert: Request Error Rate ────────────────────────────────────────────────
resource "google_monitoring_alert_policy" "error_rate" {
  display_name = "SyncDeck — High 5xx Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run 5xx errors > 5/min"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.app_name}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "60s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.ops_email.name]
  severity              = "CRITICAL"

  alert_strategy {
    auto_close = "900s"
  }
}

# ─── Alert: High Request Latency ──────────────────────────────────────────────
resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "SyncDeck — High Request Latency (p99)"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run p99 latency > 3s"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.app_name}\" AND metric.type=\"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 3000  # milliseconds
      duration        = "120s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_99"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.ops_email.name]
  severity              = "WARNING"

  alert_strategy {
    auto_close = "1800s"
  }
}

# ─── Alert: Instance Count Maxed Out ──────────────────────────────────────────
resource "google_monitoring_alert_policy" "max_instances" {
  display_name = "SyncDeck — Scaling Ceiling Reached"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run instance count at max (20)"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.app_name}\" AND metric.type=\"run.googleapis.com/container/instance_count\""
      comparison      = "COMPARISON_GE"
      threshold_value = 18  # Alert at 90% of max (18/20)
      duration        = "300s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.ops_email.name]
  severity              = "WARNING"

  alert_strategy {
    auto_close = "3600s"
  }
}
