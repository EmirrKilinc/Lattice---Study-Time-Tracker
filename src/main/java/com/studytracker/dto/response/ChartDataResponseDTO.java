package com.studytracker.dto.response;

import java.util.List;

public class ChartDataResponseDTO {

    private String period;
    private List<ChartDataPointDTO> data;

    public ChartDataResponseDTO() {}

    public ChartDataResponseDTO(String period, List<ChartDataPointDTO> data) {
        this.period = period;
        this.data = data;
    }

    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }

    public List<ChartDataPointDTO> getData() { return data; }
    public void setData(List<ChartDataPointDTO> data) { this.data = data; }
}
