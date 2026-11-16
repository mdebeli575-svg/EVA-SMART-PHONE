package com.evamobile.web;

import com.evamobile.dto.DmMessageCreateRequest;
import com.evamobile.dto.DmThreadCreateRequest;
import com.evamobile.dto.DmThreadResponse;
import com.evamobile.service.DmService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/messages")
public class DmController {

    private final DmService messages;

    public DmController(DmService messages) {
        this.messages = messages;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DmThreadResponse create(@Valid @RequestBody DmThreadCreateRequest request) {
        return messages.createThread(request);
    }

    @GetMapping("/{threadCode}")
    public DmThreadResponse get(@PathVariable String threadCode, @RequestParam String phone) {
        return messages.getThreadForCustomer(threadCode, phone);
    }

    @PostMapping("/{threadCode}/reply")
    public DmThreadResponse reply(@PathVariable String threadCode,
                                  @RequestParam String phone,
                                  @Valid @RequestBody DmMessageCreateRequest request) {
        return messages.customerReply(threadCode, phone, request);
    }
}